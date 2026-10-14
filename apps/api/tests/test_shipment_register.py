from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.shipments import PlannedShipmentPayload, shipment_register
from app.expeditions import register

KEY = '2c15b8ef-3e6b-4d93-8612-1cd5eca57023'
ROUTE = '9b053f0d-72e5-409b-915e-4198be7f6adc'


def database(monkeypatch, existing=None, route=True):
    engine, conn = MagicMock(), MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    engine.connect.return_value.__enter__.return_value = conn
    statements = []
    def execute(statement, params):
        sql = str(statement)
        assert set(statement.compile().params) <= params.keys()
        statements.append((sql, params))
        result = MagicMock()
        result.scalar_one.return_value = 1
        result.mappings.return_value.__iter__.return_value = iter([])
        result.mappings.return_value.first.return_value = existing if 'creation_hash' in sql else (
            {'route_name':'Chine → RDC','origin_country':'CN','origin_city':'Guangzhou',
             'destination_country':'CD','destination_city':'Kinshasa','transport_mode':'AIR'} if route else None)
        return result
    conn.execute.side_effect = execute
    monkeypatch.setattr(register, 'engine', engine)
    event = MagicMock()
    monkeypatch.setattr(register, '_insert_event', event)
    return statements, event


def test_register_is_scoped_paginated_and_without_finance(monkeypatch):
    statements, _ = database(monkeypatch)
    register.listing('office', q="EXP_%'", stage='planned', start=date(2026,10,1), end=date(2026,10,14), page=2)
    for sql, params in statements:
        assert 'e.org_id=:org_id' in sql
        assert 'e.archived_at is null' in sql
        assert 'create table' not in sql
        assert params['q'] == "%EXP!_!%'%"
        assert params['offset'] == 50
    projection = statements[-1][0]
    assert 'ep.removed_at is null' in projection
    assert 'p.org_id=ep.org_id' in projection
    assert 'billed_total' not in projection and 'phone' not in projection


def test_invalid_dates_do_not_query(monkeypatch):
    listing = MagicMock()
    monkeypatch.setattr(register, 'listing', listing)
    with pytest.raises(HTTPException) as exc:
        shipment_register(start=date(2026,10,14), end=date(2026,10,1), tenant={'org_id':'office'})
    assert exc.value.status_code == 422
    listing.assert_not_called()


def test_location_filters_are_bound_and_tenant_scoped(monkeypatch):
    statements,_=database(monkeypatch)
    register.listing('office',origin="A, CN",destination="B' OR 1=1, CD")
    for sql,params in statements:
        assert "concat_ws(', ',e.origin_city,e.origin_country)=:origin" in sql
        assert "concat_ws(', ',e.destination_city,e.destination_country)=:destination" in sql
        assert params['destination']=="B' OR 1=1, CD"
        assert "OR 1=1" not in sql


@pytest.mark.parametrize('extra', [{'status':'DISPATCHED'}, {'org_id':'foreign'}, {'packages_count':100}, {'departed_at':'2026-10-14T10:00:00Z'}])
def test_creation_rejects_client_controlled_state(extra):
    with pytest.raises(ValidationError):
        PlannedShipmentPayload(route_id=ROUTE, request_key=KEY, **extra)


def test_naive_planned_datetime_rejected():
    with pytest.raises(ValidationError):
        PlannedShipmentPayload(route_id=ROUTE, request_key=KEY, planned_departure_at='2026-10-14T10:00:00')


def test_creation_is_planned_with_server_context_and_no_notification(monkeypatch):
    statements, event = database(monkeypatch)
    result = register.create('office','actor',ROUTE,None,KEY)
    assert result['id'] == KEY and result['replayed'] is False
    insert = next((sql,p) for sql,p in statements if 'insert into cargo_expeditions' in sql)
    assert "'PREPARING'" in insert[0]
    assert insert[1]['planned'] is None
    assert insert[1]['origin_country'] == 'CN'
    assert 'departed_at' not in insert[0]
    assert not any('notification' in sql or 'cargo_packages' in sql for sql,_ in statements)
    assert event.call_args.kwargs['new_status'] == 'PREPARING'
    assert len(event.call_args.kwargs['metadata']['creation_hash']) == 64


def test_replay_returns_existing_without_mutation_even_after_route_removed(monkeypatch):
    _, event = database(monkeypatch)
    register.create('office','actor',ROUTE,None,KEY)
    fingerprint = event.call_args.kwargs['metadata']['creation_hash']
    statements, event = database(monkeypatch, existing={'org_id':'office','created_by':'actor','creation_hash':fingerprint,'expedition_reference':'EXP-OLD'}, route=False)
    result = register.create('office','actor',ROUTE,None,KEY)
    assert result == {'id':KEY,'reference':'EXP-OLD','replayed':True}
    event.assert_not_called()
    assert not any('insert into' in sql for sql,_ in statements)


@pytest.mark.parametrize('existing', [
    {'org_id':'foreign','created_by':'actor','creation_hash':'x','expedition_reference':'secret'},
    {'org_id':'office','created_by':'other','creation_hash':'x','expedition_reference':'secret'},
    {'org_id':'office','created_by':'actor','creation_hash':'changed','expedition_reference':'secret'},
])
def test_request_key_cannot_reuse_another_creation(monkeypatch, existing):
    statements, event = database(monkeypatch, existing=existing)
    with pytest.raises(HTTPException) as exc:
        register.create('office','actor',ROUTE,None,KEY)
    assert exc.value.status_code == 409
    assert 'secret' not in exc.value.detail
    event.assert_not_called()


def test_unavailable_route_cannot_create(monkeypatch):
    statements, event = database(monkeypatch, route=False)
    with pytest.raises(HTTPException) as exc:
        register.create('office','actor',ROUTE,datetime(2026,10,14,tzinfo=timezone.utc),KEY)
    assert exc.value.detail == 'shipment_route_unavailable'
    assert not any('insert into' in sql for sql,_ in statements)
    event.assert_not_called()
