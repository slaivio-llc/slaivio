from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text


def _money(value):
    return Decimal(str(value or 0)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)


def departure_clearance(connection, org_id, package):
    """Return an explainable manual-payment decision without changing data."""
    invoice = connection.execute(text("""select id::text, total, currency
        from finance_documents where org_id=:o and package_id=:p
        and document_type='INVOICE' and status<>'VOID'
        order by created_at desc limit 1"""), {'o': org_id, 'p': package['id']}).mappings().first()
    service_id = package.get('shipping_service_id')
    policy = connection.execute(text("""select * from finance_due_policies
        where org_id=:o and is_active=true and trigger_event='DEPARTURE'
        and (shipping_service_id is null or shipping_service_id=:service)
        order by (shipping_service_id is not null) desc, row_version desc, created_at desc
        limit 1"""), {'o': org_id, 'service': service_id}).mappings().first()
    if not policy:
        return {'allowed': False, 'code': 'FINANCE_POLICY_MISSING', 'reference': package.get('package_reference'),
                'message': 'Aucune condition financière avant départ n’est configurée pour ce service ou cette agence.'}
    if not invoice:
        return {'allowed': False, 'code': 'FINANCE_INVOICE_MISSING', 'reference': package.get('package_reference'),
                'message': 'Le montant du colis n’est pas encore facturé ; le départ ne peut pas être évalué.'}
    total = _money(invoice['total'])
    if str(policy['rule_type']).upper() == 'FIXED_AMOUNT':
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
    return {'allowed': remaining == 0, 'code': None if remaining == 0 else 'PAYMENT_CLEARANCE_REQUIRED',
            'reference': package.get('package_reference'), 'policy': policy['name'],
            'required': str(required), 'paid': str(paid), 'remaining': str(remaining),
            'currency': invoice['currency'], 'message': None if remaining == 0 else
            f"Condition : {policy['name']}. Montant requis : {required} {invoice['currency']}. "
            f"Montant confirmé : {paid} {invoice['currency']}. Reste avant départ : {remaining} {invoice['currency']}."}
