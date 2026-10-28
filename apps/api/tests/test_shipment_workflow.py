from typing import cast
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.shipments import ShipmentCancelPayload, ShipmentLoadingPayload, ShipmentMilestonePayload
from app.expeditions import workflow


def shipment(**values):
    result = dict(id='shipment', reference='EXP-1', workflow_version=2, version=3,
                  stage='planned', status='PREPARING', departed_at=None, arrived_at=None,
                  route_id='route', shipping_service_id='service',
                  destination_city='Kinshasa', destination_country='CD')
    result.update(values)
    return result


def parcel(**values):
    result = dict(id='parcel', org_id='office', status='RECEIVED', route_id='route',
                  shipping_service_id='service',
                  client_id='client', destination_city='Kinshasa', destination_country='CD',
                  fees_total=100, fees_paid=100, payment_status='PAID', deleted_at=None)
    result.update(values)
    return result


def database(monkeypatch, row=None, parcels=None, assigned=None, payment=True):
    conn, engine = MagicMock(), MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    engine.connect.return_value.__enter__.return_value = conn
    monkeypatch.setattr(workflow, 'engine', engine)
    monkeypatch.setattr(workflow, 'require_shipment', lambda *a, **k: row or shipment())
    events, package_events, queue = MagicMock(), MagicMock(), MagicMock(return_value='notification')
    monkeypatch.setattr(workflow, '_insert_event', events)
    monkeypatch.setattr(workflow, '_insert_package_event', package_events)
    monkeypatch.setattr(workflow, '_queue_customer_status_notification', queue)
    monkeypatch.setattr(workflow, 'departure_clearance', lambda *_args, **_kwargs: {'allowed': True})
    statements = []
    def execute(statement, params):
        sql = str(statement)
        assert set(statement.compile().params) <= params.keys()
        statements.append((sql, params))
        result = MagicMock()
        result.mappings.return_value.all.return_value = parcels if parcels is not None else [parcel()]
        result.scalars.return_value.all.return_value = assigned or []
        result.first.return_value = None
        result.scalar_one.return_value = payment
        return result
    conn.execute.side_effect = execute
    return conn, statements, events, package_events, queue


@pytest.mark.parametrize('change,code', [({'workflow_version':1},'legacy_shipment_requires_review'),
    ({'version':4},'stale_shipment_version'),({'departed_at':'date'},'shipment_loading_closed'),
    ({'stage':'arrived'},'shipment_loading_closed')])
def test_editable_rejects_unsafe_state(change,code):
    row=shipment();row.update(change)
    with pytest.raises(HTTPException) as exc: workflow.editable(row,3)
    assert exc.value.detail==code


@pytest.mark.parametrize('change,reason', [({'status':'CONFIRMED'},'parcel_not_received'),
    ({'client_id':None},'client_missing'),({'route_id':'other'},'route_mismatch'),
    ({'shipping_service_id':'other-service'},'service_mismatch'),
    ({'destination_city':'Other'},'destination_mismatch'),({'other_assignment':True},'already_assigned'),
    ({'departure_assignment':True},'already_assigned'),({'validation_status':'BLOCKED'},'quality_review_required')])
def test_eligibility(change,reason):
    assert reason in workflow.compatible(shipment(),parcel(**change))


def test_loading_never_changes_physical_state(monkeypatch):
    _, statements, events, pe, queue = database(monkeypatch)
    assert workflow.loading('office','shipment','actor',3,['parcel','parcel'])=={'changed':1}
    updates=[sql for sql,_ in statements if sql.startswith('update cargo_packages')]
    assert len(updates)==1 and 'status=' not in updates[0]
    assert any('order by p.id for update' in sql for sql,_ in statements)
    assert events.call_args.kwargs['event_type']=='PACKAGE_ADDED'
    assert pe.call_count==1
    queue.assert_not_called()


def test_already_assigned_conflict_does_not_write(monkeypatch):
    _, statements, events, _, _=database(monkeypatch,assigned=['other'])
    with pytest.raises(HTTPException) as exc: workflow.loading('office','shipment','actor',3,['parcel'])
    assert exc.value.status_code==409
    assert not any(sql.startswith(('update','insert')) for sql,_ in statements)
    events.assert_not_called()


def test_service_mismatch_is_rejected_before_assignment_writes(monkeypatch):
    _, statements, events, _, _=database(monkeypatch,parcels=[parcel(shipping_service_id='other-service')])
    with pytest.raises(HTTPException) as exc:
        workflow.loading('office','shipment','actor',3,['parcel'])
    assert exc.value.status_code==409
    detail = cast(object, exc.value.detail)
    assert isinstance(detail, dict)
    assert detail['reasons']==['service_mismatch']
    assert not any(sql.startswith(('update','insert')) for sql,_ in statements)
    events.assert_not_called()


def test_remove_leaves_physical_state_unchanged(monkeypatch):
    _, statements, _, _, queue=database(monkeypatch,assigned=['shipment'])
    assert workflow.loading('office','shipment','actor',3,['parcel'],True)=={'changed':1}
    assert any('removed_at=now()' in sql for sql,_ in statements)
    assert not any('status=' in sql for sql,_ in statements if sql.startswith('update cargo_packages'))
    queue.assert_not_called()


def test_cancel_releases_assigned_packages_without_changing_their_physical_state(monkeypatch):
    _, statements, events, package_events, queue = database(monkeypatch, parcels=[parcel()])
    assert workflow.cancel('office','shipment','actor',3,'Expédition créée par erreur') == {
        'changed': True, 'released_packages': 1,
    }
    assert any("status='CANCELLED'" in sql for sql,_ in statements if sql.startswith('update cargo_expeditions'))
    assert any('removed_at=now()' in sql for sql,_ in statements if sql.startswith('update expedition_packages'))
    package_update=next(sql for sql,_ in statements if sql.startswith('update cargo_packages'))
    assert 'shipment_reference=null' in package_update and 'status=' not in package_update
    assert events.call_args.kwargs['event_type']=='EXPEDITION_CANCELLED'
    assert package_events.call_args.kwargs['event_type']=='EXPEDITION_CANCELLED'
    queue.assert_not_called()


def test_cancel_is_idempotent_after_a_lost_response(monkeypatch):
    row=shipment(status='CANCELLED')
    _, statements, events, _, _=database(monkeypatch,row=row)
    assert workflow.cancel('office','shipment','actor',3,'Même requête')=={'changed':False}
    assert not statements
    events.assert_not_called()


def test_departure_snapshot_and_notifications_share_transaction(monkeypatch):
    _, statements, events, pe, queue=database(monkeypatch)
    result=workflow.milestone('office','shipment','actor',3,'depart')
    assert result=={'changed':True,'notification_ids':['notification']}
    assert any('insert into expedition_departure_manifests' in sql for sql,_ in statements)
    assert any(params.get('status')=='SHIPPED' for sql,params in statements)
    package_update = next(sql for sql,_ in statements if sql.startswith('update cargo_packages'))
    assert 'current_status' not in package_update
    assert queue.call_args.args[2]=='SHIPPED'
    assert events.call_args.kwargs['event_type']=='SHIPMENT_DEPARTED'
    assert pe.call_args.kwargs['previous_status']=='RECEIVED'


@pytest.mark.parametrize('changes', [{'status':'DELIVERED'},{'deleted_at':'date'}])
def test_departure_fails_closed_without_writes(monkeypatch,changes):
    _, statements, events, _, queue=database(monkeypatch,parcels=[parcel(**changes)])
    with pytest.raises(HTTPException): workflow.milestone('office','shipment','actor',3,'depart')
    assert not any(sql.startswith(('update','insert')) for sql,_ in statements)
    events.assert_not_called();queue.assert_not_called()


def test_empty_departure_rejected(monkeypatch):
    database(monkeypatch,parcels=[])
    with pytest.raises(HTTPException) as exc: workflow.milestone('office','shipment','actor',3,'depart')
    assert exc.value.detail=='shipment_empty'


def test_retry_does_not_duplicate_departure(monkeypatch):
    row=shipment();row.update(status='DISPATCHED',stage='departed',version=4)
    _, statements, _, _, queue=database(monkeypatch,row=row)
    assert workflow.milestone('office','shipment','actor',3,'depart')['changed'] is False
    assert not statements;queue.assert_not_called()


def test_arrival_does_not_deliver_or_replace_snapshot(monkeypatch):
    row=shipment();row.update(status='DISPATCHED',stage='departed',departed_at='2026-10-18T10:00:00Z')
    _, statements, _, _, queue=database(monkeypatch,row=row,parcels=[parcel(status='SHIPPED')])
    workflow.milestone('office','shipment','actor',3,'arrive')
    assert queue.call_args.args[2]=='ARRIVED_DESTINATION'
    assert not any('expedition_departure_manifests' in sql for sql,_ in statements)


def test_arrival_requires_a_recorded_departure(monkeypatch):
    row=shipment();row.update(status='DISPATCHED',stage='departed',departed_at=None)
    _, statements, events, _, queue=database(monkeypatch,row=row,parcels=[parcel(status='SHIPPED')])
    with pytest.raises(HTTPException) as exc:
        workflow.milestone('office','shipment','actor',3,'arrive')
    assert exc.value.status_code==409
    assert exc.value.detail=='shipment_departure_not_confirmed'
    assert not any(sql.startswith(('update','insert')) for sql,_ in statements)
    events.assert_not_called();queue.assert_not_called()


def test_command_schemas_are_bounded():
    with pytest.raises(ValidationError): ShipmentLoadingPayload(expected_version=1,package_ids=[])
    with pytest.raises(ValidationError): ShipmentLoadingPayload(expected_version=1,package_ids=[uuid4() for _ in range(201)])
    with pytest.raises(ValidationError): ShipmentMilestonePayload.model_validate({'expected_version': 1, 'action': 'deliver'})
    with pytest.raises(ValidationError): ShipmentMilestonePayload.model_validate({'expected_version': 1, 'action': 'depart', 'org_id': 'other'})
    with pytest.raises(ValidationError): ShipmentCancelPayload(expected_version=1,reason='')


def test_legacy_archive_or_bulk_status_cannot_bypass_managed_loading():
    from app.packages.repository import _protect_managed_loading
    conn=MagicMock()
    conn.execute.return_value.first.return_value=(1,)
    with pytest.raises(HTTPException) as exc: _protect_managed_loading(conn,'office',['parcel'])
    assert exc.value.status_code==409
    sql,params=conn.execute.call_args.args
    assert 'e.workflow_version=2' in str(sql)
    assert params=={'org_id':'office','ids':['parcel']}


def test_historical_manifest_never_requeries_current_clients(monkeypatch):
    conn, statements, _, _, _=database(monkeypatch)
    conn.execute.side_effect=None
    snapshot={'shipment':{'reference':'EXP-HIST'},'items':[{'id':'parcel','client_name':'Original name','weight_kg':None}]}
    conn.execute.return_value.mappings.return_value.first.return_value={'payload':snapshot,'created_at':'date'}
    result=workflow.manifest('office','shipment')
    assert result['historical_snapshot'] is True
    assert result['items'][0]['client_name']=='Original name'
    assert result['items'][0]['weight_kg'] is None
    assert conn.execute.call_count==1


def test_old_departure_without_snapshot_is_not_fabricated(monkeypatch):
    row=shipment();row['stage']='departed'
    conn, _, _, _, _=database(monkeypatch,row=row)
    conn.execute.side_effect=None
    conn.execute.return_value.mappings.return_value.first.return_value=None
    with pytest.raises(HTTPException) as exc: workflow.manifest('office','shipment')
    assert exc.value.detail=='historical_manifest_unavailable'
    assert conn.execute.call_count==1


def test_manifest_excel_preserves_unknown_weight_and_literal_text(monkeypatch):
    import io
    from openpyxl import load_workbook
    from app.api.shipments import shipment_manifest_excel
    monkeypatch.setattr(workflow,'manifest',lambda *args:{'shipment':{'reference':'=1+1'},'departed_at':None,'historical_snapshot':False,
        'items':[{'reference':'=CMD()', 'client_name':'+NAME','supplier_tracking':'@EXT','weight_kg':None}]})
    response=shipment_manifest_excel(uuid4(),{'org_id':'office'})
    book=load_workbook(io.BytesIO(response.body))
    sheet=book.active
    assert sheet is not None
    assert sheet['B1'].value=='=1+1' and sheet['B1'].data_type=='s'
    assert sheet is not None
    assert sheet['A10'].value=='=CMD()' and sheet['A10'].data_type=='s'
    assert sheet is not None
    assert sheet['D10'].value is None and sheet['B7'].value is None
    assert response.headers['cache-control']=='no-store'
