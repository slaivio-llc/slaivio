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
    current = {
        'id': 'policy-1',
        'org_id': 'agency',
        'name': 'Reception 50%',
        'shipping_service_id': None,
        'trigger_event': 'RECEPTION',
        'rule_type': 'PERCENTAGE',
        'percentage': 50,
        'fixed_amount': None,
        'currency': 'USD',
        'is_active': True,
        'row_version': 1,
    }
    def db_result(row=None):
        value = MagicMock()
        value.mappings.return_value.first.return_value = row
        value.mappings.return_value.one.return_value = row
        return value
    conn.execute.side_effect = [MagicMock(), db_result(None), db_result(current), MagicMock(), db_result({**current, 'row_version': 2})]
    monkeypatch.setattr(repository, 'engine', engine)
    monkeypatch.setattr(repository, 'event', MagicMock())
    result = repository.upsert_due_policy('agency', 'actor', 'Agent', {
        'name': 'Reception 50%',
        'trigger_event': 'RECEPTION',
        'rule_type': 'PERCENTAGE',
        'percentage': 50,
        'currency': 'USD',
        'is_active': True,
    })
    assert result['row_version'] == 2
    sql = [str(call.args[0]) for call in conn.execute.call_args_list]
    assert any('pg_advisory_xact_lock' in statement for statement in sql)
    assert any('is_active=false' in statement for statement in sql)
    assert any('row_version=row_version+1' in statement for statement in sql)


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


def test_create_uses_selected_office_for_scoped_members(monkeypatch):
    from app.api import finance as api

    captured = {}

    def fake_create(org_id, actor_id, actor_name, payload):
        captured['payload'] = payload
        return {'created': True, 'office_id': payload.get('office_id')}

    monkeypatch.setattr(api.repo, 'create', fake_create)
    payload = api.DocumentCreate.model_validate({'document_type': 'INVOICE', 'client_id': 'client-1', 'currency': 'USD', 'office_id': None, 'lines': [{'description': 'Cargo', 'quantity': 1, 'unit_price': 10, 'discount_rate': 0, 'tax_rate': 0}]})
    result = api.resolve_create_payload(payload, {'selected_office_id': 'office-1', 'allowed_office_ids': ['office-1']})

    assert result['office_id'] == 'office-1'
    assert captured == {}
