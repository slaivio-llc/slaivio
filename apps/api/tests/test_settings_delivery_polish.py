import json
from unittest.mock import MagicMock
import pytest
from pydantic import ValidationError
from app.api import organization_admin as api
from app.organization_admin import repository as repo
from app.expeditions.repository import generate_expedition_reference


def database(monkeypatch):
    engine=MagicMock();connection=engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(repo,'engine',engine);monkeypatch.setattr(repo,'_audit',MagicMock())
    return connection


def test_missing_reference_format_can_be_created_without_overwriting_a_counter(monkeypatch):
    conn=database(monkeypatch)
    conn.execute.return_value.mappings.return_value.first.return_value={'id':'format','row_version':1}
    assert repo.save_numbering('agency','owner','PACKAGE','COL-{YYYY}-{000001}',0)['row_version']==1
    sql,params=conn.execute.call_args.args
    assert 'on conflict(org_id,document_type) do nothing' in str(sql)
    assert params['o']=='agency'
    assert 'next_number' not in str(sql)


def test_a_concurrently_created_reference_format_is_not_overwritten(monkeypatch):
    conn=database(monkeypatch);conn.execute.return_value.mappings.return_value.first.return_value=None
    assert repo.save_numbering('agency','owner','PACKAGE','COL-{YYYY}-{000001}',0) is None
    repo._audit.assert_not_called()


def test_shipment_references_use_the_agency_counter_in_the_creation_transaction():
    conn=MagicMock();conn.execute.return_value.scalar_one.return_value='ABC-2026-000009'
    assert generate_expedition_reference(conn,'agency')=='ABC-2026-000009'
    sql,params=conn.execute.call_args.args
    assert 'next_shipment_reference' in str(sql)
    assert params=={'org':'agency'}


def test_account_deletion_requires_the_exact_confirmation():
    with pytest.raises(ValidationError):api.OwnAccountDeletion(confirmation='oui')


def test_deletion_endpoint_uses_only_the_authenticated_account(monkeypatch):
    request=MagicMock(return_value={'id':'request','status':'PENDING'})
    monkeypatch.setattr(repo,'request_own_account_deletion',request)
    body=api.OwnAccountDeletion(confirmation='SUPPRIMER',user_id='someone-else')
    api.request_account_deletion(body,{'org_id':'agency'},{'user_id':'current-user'})
    request.assert_called_once_with('agency','current-user')


@pytest.mark.parametrize('sole_owner',[True,False])
def test_deletion_is_a_reviewed_request_and_creates_a_support_ticket(monkeypatch,sole_owner):
    conn=database(monkeypatch)
    conn.execute.return_value.scalar_one.return_value=sole_owner
    conn.execute.return_value.mappings.return_value.first.return_value=None
    conn.execute.return_value.mappings.return_value.one.return_value={'id':'request','status':'PENDING'}
    result=repo.request_own_account_deletion('agency','current-user')
    assert result['status']=='PENDING'
    calls=[(str(call.args[0]),call.args[1]) for call in conn.execute.call_args_list]
    assert not any('delete from' in sql.lower() or "status='SUSPENDED'" in sql for sql,_ in calls)
    params=next(params for sql,params in calls if 'insert into organization_data_requests' in sql)
    assert json.loads(params['scope'])=={'user_id':'current-user','manual_review_required':True,'ownership_review_required':sole_owner}
    assert any('insert into support_tickets' in sql for sql,_ in calls)


def test_repeated_account_deletion_request_reuses_the_pending_request(monkeypatch):
    conn=database(monkeypatch);conn.execute.return_value.scalar_one.return_value=False
    conn.execute.return_value.mappings.return_value.first.return_value={'id':'existing','status':'PENDING'}
    assert repo.request_own_account_deletion('agency','current-user')['id']=='existing'
    assert not any('insert into' in str(call.args[0]) for call in conn.execute.call_args_list)
