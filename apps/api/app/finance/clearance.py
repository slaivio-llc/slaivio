from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text


def _money(value):
    return Decimal(str(value or 0)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)


def _policy_for_event(connection, org_id, package, invoice, trigger_event):
    service_id = package.get('shipping_service_id')
    snapshot = connection.execute(text("""select o.amount,o.currency,
        coalesce(o.policy_name_snapshot,p.name) as name,o.policy_row_version
        from finance_due_obligations o join finance_due_policies p
          on p.org_id=o.org_id and p.id=o.policy_id
        where o.org_id=:o and o.document_id=cast(:document as uuid) and o.trigger_event=:event
          and o.status<>'VOID' and (p.shipping_service_id is null or p.shipping_service_id=:service)
        order by (p.shipping_service_id is not null) desc,o.created_at desc limit 1"""),
        {'o': org_id, 'document': invoice['id'], 'service': service_id, 'event': trigger_event}
    ).mappings().first() if invoice else None
    if snapshot:
        return snapshot
    if invoice and invoice.get('due_policy_snapshot_at'):
        return None
    return connection.execute(text("""select * from finance_due_policies
        where org_id=:o and is_active=true and trigger_event=:event
        and (shipping_service_id is null or shipping_service_id=:service)
        order by (shipping_service_id is not null) desc, row_version desc, created_at desc
        limit 1"""), {'o': org_id, 'service': service_id, 'event': trigger_event}
    ).mappings().first()


def _clearance(connection, org_id, package, trigger_event, *, missing_policy_allowed):
    """Return an explainable manual-payment decision without changing data."""
    invoice = connection.execute(text("""select id::text, total, currency,due_policy_snapshot_at
        from finance_documents where org_id=:o and package_id=:p
        and document_type='INVOICE' and status in ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE')
        order by created_at desc limit 1"""), {'o': org_id, 'p': package['id']}).mappings().first()
    snapshot = _policy_for_event(connection, org_id, package, invoice, trigger_event)
    policy = snapshot
    if not policy:
        # An explicit ARRIVAL policy means no amount is due before the shipment
        # leaves. Respect the invoice's policy snapshot when one exists.
        if trigger_event == 'DEPARTURE':
            arrival_policy = _policy_for_event(connection, org_id, package, invoice, 'ARRIVAL')
            if arrival_policy:
                return {'allowed': True, 'code': None, 'reference': package.get('package_reference'),
                        'policy': arrival_policy.get('name'), 'policy_configured': True,
                        'due_at': 'ARRIVAL', 'message': None}
        if missing_policy_allowed:
            return {'allowed': True, 'code': None, 'reference': package.get('package_reference'),
                    'message': None, 'policy_configured': False}
        return {'allowed': False, 'code': 'FINANCE_POLICY_MISSING', 'reference': package.get('package_reference'),
                'message': 'Aucune condition financière avant départ n’est configurée pour ce service ou cette agence.'}
    if not invoice:
        return {'allowed': False, 'code': 'FINANCE_INVOICE_MISSING', 'reference': package.get('package_reference'),
                'message': 'Le montant du colis n’est pas encore facturé ; la condition financière ne peut pas être évaluée.'}
    total = _money(invoice['total'])
    if snapshot and 'amount' in snapshot:
        required = _money(snapshot['amount'])
    elif str(policy['rule_type']).upper() == 'FIXED_AMOUNT':
        required = _money(policy['fixed_amount'])
    else:
        required = _money(total * Decimal(str(policy['percentage'] or 0)) / Decimal('100'))
    if invoice['currency'] != policy['currency']:
        return {'allowed': False, 'code': 'FINANCE_POLICY_CURRENCY_MISMATCH', 'reference': package.get('package_reference'),
                'message': 'La devise de la condition ne correspond pas à celle de la facture.'}
    paid = connection.execute(text("""select coalesce(sum(amount),0) from finance_payments
        where org_id=:o and document_id=:d and status='CONFIRMED' and currency=:currency"""),
        {'o': org_id, 'd': invoice['id'], 'currency': invoice['currency']}).scalar_one()
    paid = _money(paid)
    remaining = _money(max(Decimal('0'), required - paid))
    point = 'avant départ' if trigger_event == 'DEPARTURE' else 'avant remise'
    return {'allowed': remaining == 0, 'code': None if remaining == 0 else 'PAYMENT_CLEARANCE_REQUIRED',
            'reference': package.get('package_reference'), 'policy': policy['name'],
            'required': str(required), 'paid': str(paid), 'remaining': str(remaining),
            'currency': invoice['currency'], 'policy_configured': True,
            'message': None if remaining == 0 else
            f"Condition : {policy['name']}. Montant requis : {required} {invoice['currency']}. "
            f"Montant confirmé : {paid} {invoice['currency']}. Reste {point} : {remaining} {invoice['currency']}."}


def departure_clearance(connection, org_id, package):
    controls = connection.execute(text("select block_departure_confirmation from finance_settings where org_id=:o"), {'o': org_id}).mappings().first()
    if controls and not controls['block_departure_confirmation']:
        return {'allowed': True, 'code': None, 'reference': package.get('package_reference'), 'message': None}
    return _clearance(connection, org_id, package, 'DEPARTURE', missing_policy_allowed=False)


def delivery_clearance(connection, org_id, package):
    """A delivery rule is enforced when configured; absence does not block release."""
    controls = connection.execute(text("select block_delivery_release from finance_settings where org_id=:o"), {'o': org_id}).mappings().first()
    if controls and not controls['block_delivery_release']:
        return {'allowed': True, 'code': None, 'reference': package.get('package_reference'), 'message': None}
    return _clearance(connection, org_id, package, 'DELIVERY', missing_policy_allowed=True)
