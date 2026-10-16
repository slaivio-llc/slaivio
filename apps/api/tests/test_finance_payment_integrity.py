from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.finance import repository as repo


@pytest.mark.parametrize('value', ['0', '-1', 'NaN', 'Infinity', '0.001'])
def test_payment_rejects_invalid_amount(value):
    with pytest.raises(HTTPException) as exc:
        repo.payment_amount(value)
    assert exc.value.status_code == 422


def connection(monkeypatch, results):
    conn = MagicMock()
    conn.execute.side_effect = results
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    engine.connect.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repo, 'engine', engine)
    return conn


def row(value):
    result = MagicMock()
    result.mappings.return_value.first.return_value = value
    result.mappings.return_value.one.return_value = value
    return result


def scalar(value):
    result = MagicMock()
    result.scalar_one.return_value = value
    return result


def payload():
    return dict(amount='30.00', currency='USD', method='CASH', reference=None,
                idempotency_key='payment-request-1', paid_at=None)


def test_retry_cannot_target_another_invoice(monkeypatch):
    old = dict(document_id='invoice-other', **payload())
    conn = connection(monkeypatch, [MagicMock(), row(old)])
    with pytest.raises(HTTPException) as exc:
        repo.pay('agency', 'invoice', 'agent', 'Agent', payload())
    assert exc.value.detail == 'payment_idempotency_conflict'
    assert conn.execute.call_count == 2
    assert 'pg_advisory_xact_lock' in str(conn.execute.call_args_list[0].args[0])


def test_same_retry_returns_existing_payment(monkeypatch):
    old = dict(document_id='invoice', **payload())
    conn = connection(monkeypatch, [MagicMock(), row(old)])
    assert repo.pay('agency', 'invoice', 'agent', 'Agent', payload()) == old
    assert conn.execute.call_count == 2


def test_partial_payment_preserves_credit(monkeypatch):
    # Invoice 100, credit 20, already paid 10: balance is 70, not 90.
    doc = dict(currency='USD', total=100, amount_paid=10, balance_due=70)
    uuid = MagicMock()
    uuid.scalar_one.return_value = 'payment'
    conn = connection(monkeypatch, [MagicMock(), row(None), row(doc), scalar(0), uuid,
                                    row({'id': 'payment'}), MagicMock(), MagicMock()])
    monkeypatch.setattr(repo, 'capture_identity', lambda *args: {'version': 1})
    monkeypatch.setattr(repo, 'receipt_number', lambda *args: 'REC-1')
    audit = MagicMock()
    monkeypatch.setattr(repo, 'event', audit)
    repo.pay('agency', 'invoice', 'agent', 'Agent', payload())
    update = conn.execute.call_args_list[-1].args[1]
    assert update['paid'] == Decimal('40')
    assert update['balance'] == Decimal('40')
    assert audit.call_args.args[3] == 'PAYMENT_RECORDED'


@pytest.mark.parametrize('currency,balance,error', [
    ('CDF', 70, 'payment_currency_mismatch'),
    ('USD', 20, 'payment_exceeds_balance'),
])
def test_invalid_payment_does_not_insert(monkeypatch, currency, balance, error):
    conn = connection(monkeypatch, [MagicMock(), row(None), row({
        'currency': currency, 'balance_due': balance,
    })])
    with pytest.raises(HTTPException) as exc:
        repo.pay('agency', 'invoice', 'agent', 'Agent', payload())
    assert exc.value.detail == error
    assert conn.execute.call_count == 3


def test_manual_payment_cannot_consume_saspay_reserved_balance(monkeypatch):
    conn = connection(monkeypatch, [MagicMock(), row(None), row({
        'currency': 'USD', 'balance_due': 70,
    }), scalar(50)])
    with pytest.raises(HTTPException) as exc:
        repo.pay('agency', 'invoice', 'agent', 'Agent', payload())
    assert exc.value.status_code == 409
    assert exc.value.detail == 'payment_conflicts_with_saspay_attempt'
    assert conn.execute.call_count == 4


def test_reversal_preserves_credit_and_audit(monkeypatch):
    conn = connection(monkeypatch, [row({'amount': 30}), row({
        'total': 100, 'amount_paid': 40, 'balance_due': 40,
    }), MagicMock(), MagicMock()])
    audit = MagicMock()
    monkeypatch.setattr(repo, 'event', audit)
    result = repo.reverse_payment('agency', 'invoice', 'payment', 'agent', 'Agent', 'Erreur')
    assert result['balance_due'] == Decimal('70')
    assert result['amount_paid'] == Decimal('10')
    assert 'REVERSED' in str(conn.execute.call_args_list[2].args[0])
    assert audit.call_args.args[3] == 'PAYMENT_REVERSED'


def test_invoice_with_open_saspay_attempt_cannot_be_voided(monkeypatch):
    conn = connection(monkeypatch, [row({'id': 'invoice'}), row({'id': 'attempt'})])
    with pytest.raises(HTTPException) as exc:
        repo.void('agency', 'invoice', 'agent', 'Agent', 1, 'duplicate')
    assert exc.value.status_code == 409
    assert exc.value.detail == 'saspay_attempt_open'
    assert conn.execute.call_count == 2


def test_stats_keep_currencies_separate(monkeypatch):
    amounts = MagicMock()
    amounts.mappings.return_value.all.return_value = [
        {'currency': 'CDF', 'invoiced': 120000, 'collected': 0, 'outstanding': 120000, 'due_now': 120000},
        {'currency': 'USD', 'invoiced': 100, 'collected': 40, 'outstanding': 60, 'due_now': 60},
    ]
    period_invoices = MagicMock()
    period_invoices.mappings.return_value.all.return_value = [{'currency': 'USD', 'amount': 100}]
    period_payments = MagicMock()
    period_payments.mappings.return_value.all.return_value = [{'currency': 'USD', 'amount': 40}]
    conn = connection(monkeypatch, [row({'invoices': 2, 'drafts': 0, 'overdue': 0, 'unpaid_invoice_count': 1, 'partially_paid_invoice_count': 1}), amounts, period_invoices, period_payments])
    result = repo.stats('agency', start_date=date(2026, 1, 1), end_date=date(2026, 1, 31))
    assert len(result['by_currency']) == 2
    assert 'outstanding' not in result
    assert result['period']['by_currency'] == [{'currency': 'USD', 'invoiced': 100, 'collected': 40}]
    assert 'group by currency' in str(conn.execute.call_args_list[1].args[0])
    assert 'period_start' in str(conn.execute.call_args_list[2].args[0])
    assert 'paid_at' in str(conn.execute.call_args_list[3].args[0])
    assert conn.execute.call_args_list[1].args[1] == {'o': 'agency', 'offices': [], 'unrestricted': True}
