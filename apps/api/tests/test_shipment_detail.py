from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.shipments import ShipmentPlanningPayload
from app.expeditions import detail


def database(monkeypatch, **overrides):
    row = {'id':'shipment','version':3,'stage':'planned','status':'PREPARING',
           'departed_at':None,'arrived_at':None,'planned_departure_at':None,**overrides}
    conn, engine = MagicMock(), MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    engine.connect.return_value.__enter__.return_value = conn
    statements = []
    def execute(statement, params):
        assert set(statement.compile().params) <= params.keys()
        statements.append((str(statement), params))
        result = MagicMock()
        result.mappings.return_value.first.return_value = row
        result.mappings.return_value.one.return_value = {'packages_count':3,'clients_count':2,'weighed_count':0,'known_weight_kg':None}
        result.mappings.return_value.__iter__.return_value = iter([])
        result.scalar_one.return_value = 51
        return result
    conn.execute.side_effect = execute
    monkeypatch.setattr(detail,'engine',engine)
    event = MagicMock()
    monkeypatch.setattr(detail,'_insert_event',event)
    return conn, statements, event


def test_overview_preserves_unknown_weight(monkeypatch):
    _, statements, _ = database(monkeypatch)
    result = detail.overview('office','shipment')
    assert result['known_weight_kg'] is None
    assert result['weighed_count'] == 0
    assert result['clients_count'] == 2
    assert 'sum(p.weight_kg)' in statements[-1][0]
    assert 'count(distinct p.client_id)' in statements[-1][0]
    assert 'coalesce' not in statements[-1][0]


def test_packages_search_is_scoped_and_paginated(monkeypatch):
    _, statements, _ = database(monkeypatch)
    result = detail.packages('office','shipment',"REF_%'",2)
    assert result['historical_snapshot'] is False
    assert result['total_pages'] == 2
    for sql, params in statements:
        assert 'org_id=:org_id' in sql
        assert 'e.deleted_at is null' in sql
        assert params['org_id'] == 'office'
    assert statements[-1][1]['offset'] == 50
    assert statements[-1][1]['q'] == "%REF!_!%'%"
    assert 'c.org_id=p.org_id' in statements[-1][0]


def test_communications_never_expose_recipient_or_message(monkeypatch):
    _, statements, _ = database(monkeypatch)
    detail.communications('office','shipment',2)
    projection = statements[-1][0].split('from expedition_notifications')[0]
    assert 'recipient' not in projection
    assert 'message' not in projection
    assert statements[-1][1]['offset'] == 30


def test_missing_shipment_prevents_all_child_queries(monkeypatch):
    conn, statements, _ = database(monkeypatch)
    conn.execute.side_effect = None
    conn.execute.return_value.mappings.return_value.first.return_value = None
    with pytest.raises(HTTPException) as exc:
        detail.packages('foreign','shipment')
    assert exc.value.status_code == 404
    assert conn.execute.call_count == 1


def test_planning_locks_and_audits_without_departure_or_notification(monkeypatch):
    _, statements, event = database(monkeypatch)
    planned = datetime(2026,10,20,9,tzinfo=timezone.utc)
    assert detail.change_plan('office','shipment','actor',3,planned,'Planning confirmé') == {'changed':True}
    assert 'for update' in statements[0][0]
    assert 'shipment_row_version=shipment_row_version+1' in statements[-1][0]
    assert 'status=' not in statements[-1][0]
    assert event.call_args.kwargs['metadata'] == {'before':None,'after':planned.isoformat()}
    assert not any('notification' in sql for sql,_ in statements)


def test_plan_can_become_unknown(monkeypatch):
    old = datetime(2026,10,20,tzinfo=timezone.utc)
    _, _, event = database(monkeypatch, planned_departure_at=old)
    detail.change_plan('office','shipment','actor',3,None,'Date à confirmer')
    assert event.call_args.kwargs['metadata'] == {'before':old.isoformat(),'after':None}


def test_unchanged_plan_has_no_event(monkeypatch):
    _, statements, event = database(monkeypatch)
    assert detail.change_plan('office','shipment','actor',3,None,'Vérification') == {'changed':False}
    assert len(statements) == 1
    event.assert_not_called()


def test_delay_in_transit_does_not_change_physical_state(monkeypatch):
    _, statements, event = database(monkeypatch,stage='departed',status='DISPATCHED')
    detail.record_delay('office','shipment','actor',3,True,'Transport interrompu')
    assert 'is_delayed=:delayed' in statements[-1][0]
    assert 'status=' not in statements[-1][0]
    assert not any('cargo_packages' in sql or 'notification' in sql for sql,_ in statements)
    assert event.call_args.kwargs['event_type']=='SHIPMENT_DELAY_CHANGED'


@pytest.mark.parametrize('overrides,expected', [({'version':4},'stale_shipment_version'),
    ({'stage':'departed'},'shipment_planning_closed'),({'stage':'arrived'},'shipment_planning_closed'),
    ({'stage':'other'},'shipment_planning_closed'),({'departed_at':datetime.now(timezone.utc)},'shipment_planning_closed')])
def test_planning_conflicts_do_not_write(monkeypatch, overrides, expected):
    _, statements, event = database(monkeypatch, **overrides)
    with pytest.raises(HTTPException) as exc:
        detail.change_plan('office','shipment','actor',3,None,'Correction')
    assert exc.value.detail == expected
    assert len(statements) == 1
    event.assert_not_called()


@pytest.mark.parametrize('payload', [
    {'expected_version':1,'planned_departure_at':None,'reason':' '},
    {'expected_version':1,'planned_departure_at':None,'reason':'OK!','status':'DISPATCHED'},
    {'expected_version':1,'reason':'OK!'},
    {'expected_version':1,'planned_departure_at':'2026-10-20T12:00:00','reason':'OK!'},
])
def test_plan_payload_is_strict(payload):
    with pytest.raises(ValidationError):
        ShipmentPlanningPayload(**payload)
