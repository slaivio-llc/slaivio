// No remote URL fetching. Invoices may only be sent to one private phone number.
export function validateInvoiceDocument(body, orgId) {
  if (!body || body.org_id !== orgId || !/^\+[1-9][0-9]{7,14}$/.test(body.to || '') ||
      !/^[0-9a-f-]{36}$/i.test(body.dispatch_id || '') || body.mime_type !== 'application/pdf' ||
      !/^Facture-[A-Za-z0-9_-]{1,100}\.pdf$/.test(body.filename || '') ||
      typeof body.message !== 'string' || body.message.length > 1024 ||
      typeof body.content_base64 !== 'string' || body.content_base64.length > 6990508 ||
      body.content_base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(body.content_base64)) {
    throw new Error('invalid_private_invoice_document');
  }
  const content = Buffer.from(body.content_base64, 'base64');
  if (content.toString('base64') !== body.content_base64 || content.length > 5 * 1024 * 1024 || content.subarray(0, 5).toString() !== '%PDF-')
    throw new Error('invalid_private_invoice_document');
  return content;
}

export async function deliverInvoiceDocument(session, body, pool) {
  const content = validateInvoiceDocument(body, session?.orgId);
  if (!session?.socket || session.status !== 'CONNECTED')
    return { success:false, http_status:409 };
  // Durable claim also prevents signed-request replay and gateway restarts from
  // sending a second copy after an ambiguous network result.
  const claimed = await pool.query(`update finance_invoice_deliveries d set gateway_started_at=now()
    from notification_outbox n where d.notification_id=$1 and d.org_id=$2
    and n.id=d.notification_id and n.org_id=d.org_id and n.dispatch_state='CLAIMED'
    and n.status='PENDING' and n.recipient_phone=$3 and d.gateway_started_at is null
    returning d.id`, [body.dispatch_id, body.org_id, body.to]);
  if (!claimed.rows.length) {
    const previous = await pool.query(`select gateway_message_id from finance_invoice_deliveries
      where notification_id=$1 and org_id=$2`, [body.dispatch_id, body.org_id]);
    if (previous.rows[0]?.gateway_message_id)
      return { success:true, provider_message_id:previous.rows[0].gateway_message_id };
    // Do not acknowledge or retry an uncertain send.
    throw new Error('invoice_dispatch_requires_reconciliation');
  }
  const result = await session.socket.sendMessage(`${body.to.slice(1)}@s.whatsapp.net`, {
    document:content, mimetype:'application/pdf', fileName:body.filename, caption:body.message,
  });
  if (!result?.key?.id) throw new Error('invoice_dispatch_requires_reconciliation');
  await pool.query(`update finance_invoice_deliveries set gateway_message_id=$3
    where notification_id=$1 and org_id=$2`, [body.dispatch_id, body.org_id, result.key.id]);
  return { success:true, provider_message_id:result.key.id };
}
