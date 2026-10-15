"""Bridge Cargo to Finance. Never recalculate pricing or mutate logistics."""
import json
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy import text

from app.finance import repository as finance


def get_package_invoice(org_id, package_id):
    with finance.engine.connect() as conn:
        if not conn.execute(text("select 1 from cargo_packages where org_id=:o and id=:p and deleted_at is null"),
                            {'o': org_id, 'p': package_id}).first():
            raise HTTPException(404, 'package_not_found')
        row = conn.execute(text("""select * from finance_documents where org_id=:o
            and package_id=:p and document_type='INVOICE' and status<>'VOID'"""),
            {'o': org_id, 'p': package_id}).mappings().first()
        return dict(row) if row else None


def invoice_payload(package):
    snapshot = package.get('pricing_snapshot')
    if not isinstance(snapshot, dict) or not snapshot:
        raise HTTPException(409, 'package_pricing_required')
    try:
        total = Decimal(str(snapshot['total']))
        fees = Decimal(str(package['fees_total']))
        if not total.is_finite() or total <= 0 or total != total.quantize(Decimal('.01')) or total != fees:
            raise ValueError()
    except (KeyError, InvalidOperation, ValueError, TypeError):
        raise HTTPException(409, 'package_pricing_inconsistent')
    currency = snapshot.get('currency')
    if not isinstance(currency, str) or len(currency) != 3 or not currency.isascii() or not currency.isalpha() or currency != currency.upper() or currency != package.get('currency'):
        raise HTTPException(409, 'package_pricing_currency_mismatch')
    # Legacy cash must be reconciled, not silently lost or counted a second time.
    if Decimal(str(package.get('fees_paid') or 0)) != 0:
        raise HTTPException(409, 'package_legacy_payments_require_reconciliation')
    if not package.get('client_id'):
        raise HTTPException(409, 'package_client_required')
    return dict(document_type='INVOICE', client_id=str(package['client_id']),
        dossier_id=None, source_document_id=None, currency=currency,
        due_date=None, notes=None, terms=None, lines=[dict(
            description=f"Transport du colis {package['package_reference']}",
            quantity=1, unit_price=total, discount_rate=0, tax_rate=0,
            metadata={'package_id': str(package['id'])})])


def create_package_invoice(org_id, package_id, actor_id, actor_name, expected_version):
    with finance.engine.begin() as conn:
        package = conn.execute(text("""select * from cargo_packages
            where org_id=:o and id=:p and deleted_at is null for update"""),
            {'o': org_id, 'p': package_id}).mappings().first()
        if not package:
            raise HTTPException(404, 'package_not_found')
        existing = conn.execute(text("""select * from finance_documents where org_id=:o
            and package_id=:p and document_type='INVOICE' and status<>'VOID'"""),
            {'o': org_id, 'p': package_id}).mappings().first()
        if existing:
            return dict(existing)
        if package['row_version'] != expected_version:
            raise HTTPException(409, 'package_version_conflict')
        payload = invoice_payload(package)
        doc = finance.create_in_transaction(conn, org_id, actor_id, actor_name, payload)
        snapshot = {'package_reference': package['package_reference'],
                    'package_version': expected_version, 'pricing': package['pricing_snapshot']}
        conn.execute(text("""update finance_documents set package_id=:p,
            operation_snapshot=cast(:snapshot as jsonb) where org_id=:o and id=:d"""),
            {'p': package_id, 'o': org_id, 'd': doc['id'], 'snapshot': json.dumps(snapshot, default=str)})
        finance.event(conn, org_id, doc['id'], 'PACKAGE_INVOICE_DRAFT_CREATED', actor_id,
                      actor_name, {'package_id': package_id, 'package_version': expected_version})
        return {**doc, 'package_id': package_id, 'operation_snapshot': snapshot}
