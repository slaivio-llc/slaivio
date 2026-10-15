from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.finance import repository


def test_due_policy_amounts_are_calculated_without_default_policy():
    assert repository.calculate_due_amount('100.00', {'rule_type': 'PERCENTAGE', 'percentage': 50}) == Decimal('50.00')
    assert repository.calculate_due_amount('100.00', {'rule_type': 'FIXED_AMOUNT', 'fixed_amount': '25.00'}) == Decimal('25.00')
    with pytest.raises(HTTPException):
        repository.calculate_due_amount('100.00', {'rule_type': 'PERCENTAGE', 'percentage': 101})


def test_due_policy_upsert_is_versioned(monkeypatch):
    engine = MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.one.return_value = {
        'id': 'policy-1',
        'org_id': 'agency',
        'name': 'Reception 50%',
        'trigger_event': 'RECEPTION',
        'rule_type': 'PERCENTAGE',
        'percentage': 50,
        'fixed_amount': None,
        'currency': 'USD',
        'is_active': True,
        'row_version': 1,
    }
    monkeypatch.setattr(repository, 'engine', engine)
    result = repository.upsert_due_policy('agency', 'actor', 'Agent', {
        'name': 'Reception 50%',
        'trigger_event': 'RECEPTION',
        'rule_type': 'PERCENTAGE',
        'percentage': 50,
        'currency': 'USD',
        'is_active': True,
    })
    assert result['row_version'] == 1
    assert 'finance_due_policies' in str(conn.execute.call_args_list[0].args[0])


def test_due_obligations_are_replayed_idempotently(monkeypatch):
    engine = MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    conn.execute.side_effect = [
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value={'id': 'doc-1', 'total': '100.00', 'currency': 'USD'})))),
        MagicMock(mappings=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[{
            'id': 'policy-1',
            'name': 'Reception 50%',
            'trigger_event': 'RECEPTION',
            'rule_type': 'PERCENTAGE',
            'percentage': 50,
            'fixed_amount': None,
            'currency': 'USD',
            'row_version': 1,
        }])))),
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value={
            'id': 'ob-1',
            'document_id': 'doc-1',
            'policy_id': 'policy-1',
            'trigger_event': 'RECEPTION',
            'amount': Decimal('50.00'),
            'currency': 'USD',
            'status': 'OPEN',
        })))),
    ]
    monkeypatch.setattr(repository, 'engine', engine)
    monkeypatch.setattr(repository, 'event', MagicMock())

    obligations = repository.evaluate_due_obligations('agency', 'doc-1', 'RECEPTION', 'actor', 'Agent')

    assert obligations[0]['amount'] == Decimal('50.00')
    assert obligations[0]['trigger_event'] == 'RECEPTION'
