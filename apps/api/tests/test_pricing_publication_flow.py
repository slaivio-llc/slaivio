from datetime import datetime,timedelta,timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from app.pricing_engine import repository as repo
from app.api import pricing


def publication(monkeypatch,**changes):
    old={'id':'grid','org_id':'org','status':'DRAFT','requires_approval':True,'approved_at':None,
         'effective_from':datetime.now(timezone.utc)-timedelta(days=1),
         'route_id':'route','shipping_service_id':'service','calculation_method':'PER_KG',**changes}
    conn=MagicMock()
    def execute(query,params):
        result=MagicMock();sql=str(query)
        if 'for update' in sql:result.mappings.return_value.first.return_value=old
        elif 'approved_by=:a' in sql:result.mappings.return_value.first.return_value={**old,'approved_at':datetime.now(timezone.utc)}
        elif 'select 1 from pricing_grids' in sql:result.first.return_value=None
        elif 'set status=:s' in sql:result.mappings.return_value.one.return_value={**old,'status':params['s'],'approved_at':datetime.now(timezone.utc)}
        return result
    conn.execute.side_effect=execute
    engine=MagicMock();engine.begin.return_value.__enter__.return_value=conn
    monkeypatch.setattr(repo,'engine',engine)
    monkeypatch.setattr(repo,'_grid_has_price',MagicMock(return_value=True))
    audit=MagicMock();monkeypatch.setattr(repo,'_audit',audit)
    return conn,engine,audit


def test_publish_approves_and_activates_in_one_transaction(monkeypatch):
    conn,engine,audit=publication(monkeypatch)
    assert repo.transition('org','grid','ACTIVE','actor','Responsable')['status']=='ACTIVE'
    assert engine.begin.call_count==1
    assert [call.args[3] for call in audit.call_args_list]==['GRID_APPROVED','GRID_ACTIVE']
    assert any('insert into pricing_approvals' in str(call.args[0]) for call in conn.execute.call_args_list)


def test_publication_preserves_the_chosen_application_date(monkeypatch):
    starts=datetime.now(timezone.utc)+timedelta(days=7)
    conn,_,audit=publication(monkeypatch,effective_from=starts)
    assert repo.transition('org','grid','ACTIVE','actor','Responsable')['effective_from']==starts
    assert [call.args[3] for call in audit.call_args_list]==['GRID_APPROVED','GRID_ACTIVE']
    closure=next(call for call in conn.execute.call_args_list if 'set effective_until=:starts' in str(call.args[0]))
    assert closure.args[1]['starts']==starts


def test_repeated_publication_is_safe_without_duplicate_approval(monkeypatch):
    conn,_,audit=publication(monkeypatch,status='ACTIVE',approved_at=datetime.now(timezone.utc))
    assert repo.transition('org','grid','ACTIVE','actor','Responsable')['status']=='ACTIVE'
    assert conn.execute.call_count==1 and audit.call_count==0


def test_missing_price_refuses_publication_before_any_approval(monkeypatch):
    conn,engine,audit=publication(monkeypatch)
    repo._grid_has_price.return_value=False
    with pytest.raises(HTTPException) as error:repo.transition('org','grid','ACTIVE','actor','Responsable')
    assert error.value.detail=='pricing_grid_has_no_price_rules'
    assert conn.execute.call_count==1 and audit.call_count==0
    assert engine.begin.return_value.__exit__.call_args.args[0] is HTTPException


def test_overlap_rolls_back_approval_and_publication_together(monkeypatch):
    conn,engine,_=publication(monkeypatch)
    original=conn.execute.side_effect
    def overlap(sql,params):
        result=original(sql,params)
        if 'select 1 from pricing_grids' in str(sql):result.first.return_value={'id':'existing'}
        return result
    conn.execute.side_effect=overlap
    with pytest.raises(HTTPException) as error:repo.transition('org','grid','ACTIVE','actor','Responsable')
    assert error.value.detail=='pricing_version_overlap'
    assert engine.begin.return_value.__exit__.call_args.args[0] is HTTPException
    assert not any('set status=:s' in str(call.args[0]) for call in conn.execute.call_args_list)


def test_publish_during_creation_checks_the_publication_permission(monkeypatch):
    from app.permissions.services import permission_service
    permission=MagicMock(side_effect=HTTPException(403,'permission_denied'))
    monkeypatch.setattr(permission_service,'assert_permission',permission)
    create=MagicMock();monkeypatch.setattr(pricing.center,'create_grid',create)
    body=pricing.GridCreate(grid_code='AIR-01',name='Tarif air',route_id='route',shipping_service_id='service',publish_on_create=True)
    with pytest.raises(HTTPException):pricing.pricing_grid_create(body,tenant={'org_id':'org','user_id':'creator'})
    permission.assert_called_once_with(user_id='creator',org_id='org',permission_code='pricing.approve')
    create.assert_not_called()


def test_draft_creation_does_not_require_publication_permission(monkeypatch):
    from app.permissions.services import permission_service
    permission=MagicMock();monkeypatch.setattr(permission_service,'assert_permission',permission)
    create=MagicMock(return_value={'id':'grid','status':'DRAFT'});monkeypatch.setattr(pricing.center,'create_grid',create)
    body=pricing.GridCreate(grid_code='AIR-01',name='Tarif air',route_id='route',shipping_service_id='service')
    assert pricing.pricing_grid_create(body,tenant={'org_id':'org','user_id':'creator'})['status']=='DRAFT'
    permission.assert_not_called()
