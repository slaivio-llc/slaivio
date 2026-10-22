from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.finance import repository
from app.finance.receipts import capture_identity, render_receipt


def payment(**overrides):
    return dict(status='CONFIRMED', receipt_number='REC-1', amount='40.00',
                currency='USD', paid_at='2026-10-15T12:00:00Z', **overrides)


def test_receipt_uses_snapshot_and_escapes_untrusted_content():
    value = payment(receipt_snapshot={'version': 1, 'agency_name': 'LUZA <script>alert(1)</script>',
        'client_name': 'Jean & Sarah', 'document_number': 'FAC-1', 'logo_url': 'javascript:alert(1)'})
    output = render_receipt(value)
    assert '<script>' not in output
    assert 'javascript:' not in output
    assert 'Jean &amp; Sarah' in output
    assert '40.00 USD' in output
    assert 'FAC-1' in output
    assert 'SLAIVIO' not in output
    assert 'Content-Security-Policy' in output


def test_https_logo_is_escaped():
    output = render_receipt(payment(receipt_snapshot={'version': 1,
        'logo_url': 'https://example.com/logo.png?x="onerror="alert(1)'}))
    assert 'src="https://example.com/logo.png?x=&quot;' in output
    assert 'referrerpolicy="no-referrer"' in output


@pytest.mark.parametrize('status,snapshot,error', [
    ('REVERSED', {'version': 1}, 'receipt_payment_not_confirmed'),
    ('CONFIRMED', None, 'receipt_historical_identity_unavailable'),
])
def test_unverified_receipts_are_not_generated(status, snapshot, error):
    data = payment(receipt_snapshot=snapshot)
    data['status'] = status
    with pytest.raises(HTTPException) as exc:
        render_receipt(data)
    assert exc.value.detail == error


def test_identity_query_is_scoped_to_org_and_document():
    conn = MagicMock()
    conn.execute.return_value.mappings.return_value.first.return_value = {'agency_name': 'LUZA'}
    assert capture_identity(conn, 'agency', 'invoice')['agency_name'] == 'LUZA'
    sql, params = conn.execute.call_args_list[0].args
    assert 'c.org_id=d.org_id' in str(sql)
    assert params == {'org_id': 'agency', 'document_id': 'invoice'}
    brand_sql, brand_params=conn.execute.call_args_list[1].args
    assert 'l.org_id=o.id' in str(brand_sql)
    assert brand_params['org_id']=='agency'


def test_foreign_or_missing_payment_has_no_receipt(monkeypatch):
    engine = MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value = None
    monkeypatch.setattr(repository, 'engine', engine)
    with pytest.raises(HTTPException) as exc:
        repository.receipt('agency', 'invoice', 'payment')
    assert exc.value.status_code == 404
    assert conn.execute.call_args.args[1] == {'o': 'agency', 'd': 'invoice', 'p': 'payment'}
