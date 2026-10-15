from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.finance import package_invoices as invoices


def package(**changes):
    return dict(id='parcel', client_id='client', package_reference='SLV-001',
                fees_total=Decimal('100'), fees_paid=0, currency='USD', row_version=3,
                pricing_snapshot={'total': '100.00', 'currency': 'USD'}, **changes)


def test_price_is_reused_not_recomputed():
    result = invoices.invoice_payload(package())
    assert result['lines'][0]['unit_price'] == Decimal('100')
    assert result['lines'][0]['quantity'] == 1
    assert result['client_id'] == 'client'
    assert result['due_date'] is None
    assert result['document_type'] == 'INVOICE'


@pytest.mark.parametrize('field,value,error', [
    ('pricing_snapshot', {}, 'package_pricing_required'),
    ('fees_total', 99, 'package_pricing_inconsistent'),
    ('pricing_snapshot', {'total': 'NaN', 'currency': 'USD'}, 'package_pricing_inconsistent'),
    ('currency', 'CDF', 'package_pricing_currency_mismatch'),
    ('fees_paid', 20, 'package_legacy_payments_require_reconciliation'),
    ('client_id', None, 'package_client_required'),
])
def test_invalid_or_unreconciled_source_rejected(field, value, error):
    source = package()
    source[field] = value
    with pytest.raises(HTTPException) as exc:
        invoices.invoice_payload(source)
    assert exc.value.detail == error


def mock_connection(monkeypatch, source, existing):
    conn = MagicMock()
    first = MagicMock(); first.mappings.return_value.first.return_value = source
    second = MagicMock(); second.mappings.return_value.first.return_value = existing
    conn.execute.side_effect = [first, second, MagicMock()]
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(invoices.finance, 'engine', engine)
    return conn


def test_duplicate_returns_same_invoice_even_after_version_changes(monkeypatch):
    conn = mock_connection(monkeypatch, package(), {'id': 'existing'})
    assert invoices.create_package_invoice('org', 'parcel', 'actor', 'Agent', 2) == {'id': 'existing'}
    assert conn.execute.call_count == 2
    assert 'for update' in str(conn.execute.call_args_list[0].args[0])


def test_version_conflict_does_not_create_document(monkeypatch):
    conn = mock_connection(monkeypatch, package(), None)
    with pytest.raises(HTTPException) as exc:
        invoices.create_package_invoice('org', 'parcel', 'actor', 'Agent', 2)
    assert exc.value.detail == 'package_version_conflict'
    assert conn.execute.call_count == 2


def test_missing_or_foreign_package_not_found(monkeypatch):
    conn = mock_connection(monkeypatch, None, None)
    with pytest.raises(HTTPException) as exc:
        invoices.create_package_invoice('org', 'parcel', 'actor', 'Agent', 3)
    assert exc.value.status_code == 404
    assert conn.execute.call_args.args[1] == {'o': 'org', 'p': 'parcel'}


def test_draft_and_snapshot_created_in_same_transaction(monkeypatch):
    conn = mock_connection(monkeypatch, package(), None)
    create = MagicMock(return_value={'id': 'invoice', 'status': 'DRAFT'})
    audit = MagicMock()
    monkeypatch.setattr(invoices.finance, 'create_in_transaction', create)
    monkeypatch.setattr(invoices.finance, 'event', audit)
    result = invoices.create_package_invoice('org', 'parcel', 'actor', 'Agent', 3)
    assert result['status'] == 'DRAFT'
    assert result['package_id'] == 'parcel'
    assert create.call_args.args[0] is conn
    assert 'operation_snapshot' in str(conn.execute.call_args.args[0])
    assert audit.call_args.args[3] == 'PACKAGE_INVOICE_DRAFT_CREATED'


@pytest.mark.parametrize('context', [
    {'selected_office_id': 'office'},
    {'office_access_scope': 'SELECTED_OFFICES', 'allowed_office_ids': []},
])
def test_finance_does_not_leak_global_ledger_to_scoped_members(context):
    from app.api.finance import require_finance_scope
    with pytest.raises(HTTPException) as exc:
        require_finance_scope(context)
    assert exc.value.status_code == 403
