from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.finance.clearance import delivery_clearance, departure_clearance


def result(value):
    item = MagicMock()
    item.mappings.return_value.first.return_value = value
    item.scalar_one.return_value = value
    return item


def conn(monkeypatch, values):
    c = MagicMock(); c.execute.side_effect = [result({'block_departure_confirmation': True, 'block_delivery_release': True}), *[result(v) for v in values]]
    return c


def package():
    return {'id': 'package', 'package_reference': 'COL-1', 'shipping_service_id': 'service'}


def test_arrival_policy_allows_departure_without_prepayment():
    c = conn(None, [
        {'id': 'invoice', 'total': 200, 'currency': 'USD'},
        None,
        None,
        None,
        {'name': 'Paiement à l’arrivée', 'trigger_event': 'ARRIVAL'},
    ])
    decision = departure_clearance(c, 'org', package())
    assert decision['allowed'] is True
    assert decision['due_at'] == 'ARRIVAL'
    assert decision['policy'] == 'Paiement à l’arrivée'
    assert c.execute.call_count == 6


def test_arrival_policy_allows_departure_even_before_invoice():
    c = conn(None, [
        None,
        None,
        {'name': 'Paiement à l’arrivée', 'trigger_event': 'ARRIVAL'},
    ])
    decision = departure_clearance(c, 'org', package())
    assert decision['allowed'] is True
    assert decision['due_at'] == 'ARRIVAL'


def test_deposit_allows_departure_when_paid(monkeypatch):
    c = conn(monkeypatch, [
        {'id': 'invoice', 'total': Decimal('200.00'), 'currency': 'USD'},
        None,
        {'name': 'Acompte 50 %', 'rule_type': 'PERCENTAGE', 'percentage': Decimal('50'), 'currency': 'USD'},
        Decimal('100.00'),
    ])
    decision = departure_clearance(c, 'org', package())
    assert decision['allowed'] is True
    assert decision['required'] == '100.00'
    assert decision['remaining'] == '0.00'


def test_departure_uses_invoice_policy_snapshot_after_rule_changes():
    c = conn(None, [
        {'id': 'invoice', 'total': Decimal('200.00'), 'currency': 'USD'},
        {'amount': Decimal('100.00'), 'currency': 'USD', 'name': 'Acompte 50 %'},
        Decimal('50.00'),
    ])
    decision = departure_clearance(c, 'org', package())
    assert decision['allowed'] is False
    assert decision['required'] == '100.00'
    assert decision['policy'] == 'Acompte 50 %'
    assert decision['remaining'] == '50.00'
    assert c.execute.call_count == 4


def test_full_payment_policy_returns_explainable_block(monkeypatch):
    c = conn(monkeypatch, [
        {'id': 'invoice', 'total': Decimal('200.00'), 'currency': 'USD'},
        None,
        {'name': 'Paiement intégral avant départ', 'rule_type': 'PERCENTAGE', 'percentage': Decimal('100'), 'currency': 'USD'},
        Decimal('50.00'),
    ])
    decision = departure_clearance(c, 'org', package())
    assert decision['allowed'] is False
    assert decision['code'] == 'PAYMENT_CLEARANCE_REQUIRED'
    assert decision['required'] == '200.00'
    assert decision['paid'] == '50.00'
    assert decision['remaining'] == '150.00'
    assert 'Montant confirmé : 50.00 USD' in decision['message']


def test_missing_invoice_is_not_treated_as_zero(monkeypatch):
    c = conn(monkeypatch, [None, {'name': 'Acompte', 'rule_type': 'PERCENTAGE', 'percentage': 50, 'currency': 'USD'}])
    decision = departure_clearance(c, 'org', package())
    assert decision['code'] == 'FINANCE_INVOICE_MISSING'
    assert 'montant' in decision['message']


def test_currency_mismatch_blocks_without_reading_payments(monkeypatch):
    c = conn(monkeypatch, [
        {'id': 'invoice', 'total': 200, 'currency': 'USD'},
        None,
        {'name': 'Acompte', 'rule_type': 'PERCENTAGE', 'percentage': 50, 'currency': 'CDF'},
    ])
    decision = departure_clearance(c, 'org', package())
    assert decision['code'] == 'FINANCE_POLICY_CURRENCY_MISMATCH'
    assert c.execute.call_count == 4


def test_delivery_without_financial_policy_does_not_add_a_global_payment_gate():
    c = conn(None, [None, None, None])
    decision = delivery_clearance(c, 'org', package())
    assert decision['allowed'] is True
    assert decision['policy_configured'] is False
    assert c.execute.call_count == 3


def test_delivery_policy_blocks_release_with_explainable_balance():
    c = conn(None, [
        {'id': 'invoice', 'total': Decimal('200.00'), 'currency': 'USD'},
        None,
        {'name': 'Paiement avant remise', 'rule_type': 'PERCENTAGE',
         'percentage': Decimal('100'), 'currency': 'USD'},
        Decimal('120.00'),
        None,  # No agency-wide customer-credit exception.
    ])
    decision = delivery_clearance(c, 'org', package())
    assert decision['allowed'] is False
    assert decision['code'] == 'PAYMENT_CLEARANCE_REQUIRED'
    assert decision['remaining'] == '80.00'
    assert '80.00 USD' in decision['message']


def test_delivery_policy_allows_release_when_amount_is_confirmed():
    c = conn(None, [
        {'id': 'invoice', 'total': Decimal('200.00'), 'currency': 'USD'},
        None,
        {'name': 'Paiement avant remise', 'rule_type': 'PERCENTAGE',
         'percentage': Decimal('100'), 'currency': 'USD'},
        Decimal('200.00'),
    ])
    decision = delivery_clearance(c, 'org', package())
    assert decision['allowed'] is True
    assert decision['remaining'] == '0.00'
