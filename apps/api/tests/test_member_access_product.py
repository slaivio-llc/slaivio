from pathlib import Path
from unittest.mock import MagicMock,Mock
import pytest
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from app.api import invitations,finance,onboarding,onboarding_experience
from app.core.auth import get_current_manager
from app.core.tenant_context import get_current_tenant
from app.core import permissions as core_permissions
from app.organizations.services import access_policy as policy,invitation_completion as completion,invitation_service
from app.organizations.services.provisioning_service import FINANCE_ROLE_PERMISSIONS,DOSSIER_ROLE_PERMISSIONS,TRACKING_ROLE_PERMISSIONS,SHIPMENT_ROLE_PERMISSIONS
from app.permissions.repositories import permission_repository as permissions
from app.finance import lookups


def test_finance_role_has_finance_capabilities_only():
    assert set(FINANCE_ROLE_PERMISSIONS)=={'finance.read','finance.create','finance.issue','finance.payments','finance.export'}
    assert not DOSSIER_ROLE_PERMISSIONS.get('FINANCE')
    assert not TRACKING_ROLE_PERMISSIONS.get('FINANCE')
    assert not SHIPMENT_ROLE_PERMISSIONS.get('FINANCE')


def test_assignment_cannot_attach_a_role_outside_active_membership(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.first.return_value=None
    monkeypatch.setattr(permissions,'engine',engine)
    assert permissions.assign_role_to_user('user','agency','foreign-owner-role') is None
    assert conn.execute.call_count==1
    assert "m.status='ACTIVE'" in str(conn.execute.call_args.args[0])


def test_assignment_replaces_old_grants_in_one_transaction(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(permissions,'engine',engine)
    permissions.assign_role_to_user('user','agency','finance-role')
    sql=[str(call.args[0]) for call in conn.execute.call_args_list]
    assert 'for update of m' in sql[0]
    assert "assignment_status='REVOKED'" in sql[1]
    assert 'insert into user_role_assignments' in sql[2]
    engine.begin.assert_called_once()


def test_permissions_ignore_stale_assignments_and_suspended_members(monkeypatch):
    engine=MagicMock();conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.fetchall.return_value=[]
    monkeypatch.setattr(permissions,'engine',engine)
    assert permissions.get_user_permissions('user','agency')==[]
    sql=str(conn.execute.call_args.args[0])
    assert "authority.status='ACTIVE' and authority.role_code=r.role_code" in sql
    assert 'r.org_id=ura.org_id' in sql


@pytest.mark.parametrize('scope,ids,owned', [('SELECTED_OFFICES',[],0),('SELECTED_OFFICES',['foreign'],0)])
def test_invalid_invitation_offices_are_rejected(scope,ids,owned):
    conn=MagicMock();conn.execute.return_value.scalar_one.return_value=owned
    with pytest.raises(HTTPException) as error:policy.validate_invitation_office_scope(conn,'agency','FINANCE',scope,ids)
    assert error.value.status_code==422


def test_restricted_inviter_cannot_grant_all_offices():
    conn=MagicMock();conn.execute.return_value.mappings.return_value.first.return_value={'id':'m','role_code':'MANAGER','office_access_scope':'SELECTED_OFFICES'}
    with pytest.raises(HTTPException) as error:policy.validate_invitation_office_scope(conn,'agency','FINANCE','ALL_OFFICES',[],'actor')
    assert error.value.detail=='invitation_office_scope_exceeds_yours'


@pytest.mark.parametrize('codes',[['platform.admin.read'],['quarantine.replay']])
def test_tenant_roles_never_grant_platform_permissions(codes):
    with pytest.raises(HTTPException):policy.validate_granted_permissions('agency','owner',codes,'OWNER')


def test_role_cannot_exceed_inviter_permissions(monkeypatch):
    monkeypatch.setattr(policy,'get_user_permissions',lambda *_:['finance.read','team.write'])
    with pytest.raises(HTTPException):policy.validate_granted_permissions('agency','staff',['finance.payments'])


def test_provider_is_not_called_when_role_validation_fails(monkeypatch):
    monkeypatch.setattr(invitation_service,'CLERK_SECRET_KEY','test-key')
    def denied(*_):raise HTTPException(403,'role_exceeds_your_permissions')
    monkeypatch.setattr(invitation_service,'validate_role_assignment',denied)
    post=Mock();monkeypatch.setattr(invitation_service.requests,'post',post)
    with pytest.raises(HTTPException):invitation_service.invite_user_to_org('agency','org_real','test@example.com','OWNER','staff')
    post.assert_not_called()


@pytest.fixture
def accepted(monkeypatch):
    local={'id':'agency','clerk_org_id':'org_real','organization_name':'Cargo','status':'ACTIVE'}
    provider={'id':'membership','organization':{'id':'org_real'},'public_user_data':{'user_id':'user','identifier':'awa@example.com'}}
    monkeypatch.setattr(completion,'verified_memberships',lambda _:[provider])
    monkeypatch.setattr(completion,'get_organization_by_clerk_org_id',lambda _:local)
    monkeypatch.setattr(completion,'get_organization_member',lambda *_:None)
    sync,switch=Mock(),Mock();monkeypatch.setattr(completion,'sync_membership_with_role',sync);monkeypatch.setattr(completion,'switch_tenant',switch)
    return local,provider,sync,switch


def test_only_provider_confirmed_membership_can_select_the_agency(accepted):
    _,_,sync,switch=accepted
    assert completion.complete_invitation({'user_id':'user'},'agency')['status']=='ok'
    assert sync.call_args.kwargs['clerk_user_id']=='user'
    assert sync.call_args.kwargs['user_email']=='awa@example.com'
    switch.assert_called_once_with('user','agency')


def test_query_parameter_alone_cannot_choose_another_agency(accepted):
    _,_,sync,switch=accepted
    with pytest.raises(HTTPException):completion.complete_invitation({'user_id':'user'},'foreign')
    sync.assert_not_called();switch.assert_not_called()


def test_provider_failure_does_not_create_a_personal_or_owner_fallback(accepted,monkeypatch):
    _,_,sync,switch=accepted
    def unavailable(_):raise HTTPException(503,'invitation_membership_verification_unavailable')
    monkeypatch.setattr(completion,'verified_memberships',unavailable)
    with pytest.raises(HTTPException) as error:completion.complete_invitation({'user_id':'user'},'agency')
    assert error.value.status_code==503
    sync.assert_not_called();switch.assert_not_called()


def test_suspended_member_cannot_reactivate_through_invitation(accepted,monkeypatch):
    _,_,sync,switch=accepted
    monkeypatch.setattr(completion,'get_organization_member',lambda *_:{'status':'SUSPENDED'})
    with pytest.raises(HTTPException):completion.complete_invitation({'user_id':'user'},'agency')
    sync.assert_not_called();switch.assert_not_called()


def test_foreign_provider_identity_is_not_trusted(accepted):
    _,provider,sync,_=accepted;provider['public_user_data']['user_id']='other'
    with pytest.raises(HTTPException):completion.complete_invitation({'user_id':'user'},'agency')
    sync.assert_not_called()


@pytest.fixture
def member_client(monkeypatch):
    app=FastAPI()
    for router in (invitations.router,finance.router,onboarding.router,onboarding_experience.router):app.include_router(router)
    app.dependency_overrides[get_current_manager]=lambda:{'user_id':'user'}
    app.dependency_overrides[get_current_tenant]=lambda:{'org_id':'agency','user_id':'user','actor_role':'FINANCE'}
    granted={'finance.read','finance.create'}
    def check(user_id,org_id,permission_code):
        if permission_code not in granted:raise HTTPException(403,'permission_denied')
    monkeypatch.setattr(core_permissions,'assert_permission',check)
    app.dependency_overrides[finance.get_current_office_context]=lambda:{'office_access_scope':'ALL_OFFICES'}
    with TestClient(app) as http:yield http,granted


def test_finance_member_cannot_reconfigure_the_agency_or_invite_staff(member_client):
    http,_=member_client
    assert http.get('/api/onboarding-experience/state').status_code==403
    assert http.post('/api/onboarding/refresh').status_code==403
    assert http.post('/organization/invitations',json={'email':'x@example.com','role_code':'OWNER'}).status_code==403


def test_finance_lookups_do_not_require_general_client_or_package_access(member_client,monkeypatch):
    http,_=member_client
    clients=Mock(return_value={'items':[]});packages=Mock(return_value={'items':[]})
    monkeypatch.setattr(lookups,'clients',clients);monkeypatch.setattr(lookups,'packages',packages)
    assert http.get('/finance/lookup/clients').status_code==200
    assert http.get('/finance/lookup/packages?client_id=11111111-1111-4111-8111-111111111111').status_code==200
    clients.assert_called_once_with('agency','',None)


def test_billing_lookup_read_only_role_cannot_prepare_invoices(member_client,monkeypatch):
    http,granted=member_client;granted.remove('finance.create')
    query=Mock();monkeypatch.setattr(lookups,'clients',query)
    assert http.get('/finance/lookup/clients').status_code==403
    query.assert_not_called()


def test_scoped_lookup_cannot_escape_empty_office_grants(monkeypatch):
    engine=MagicMock();conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.all.return_value=[]
    monkeypatch.setattr(lookups,'engine',engine)
    assert lookups.packages('agency','client',[])=={'items':[]}
    sql,params=conn.execute.call_args.args
    assert params['unrestricted'] is False and params['offices']==[]
    assert 'p.org_id=:org' in str(sql)
    assert 'origin_location_id=any' in str(sql)


def test_migration_preserves_custom_roles_and_revokes_stale_grants():
    sql=(Path(__file__).resolve().parents[3]/'infra/sql/161_invited_member_access.sql').read_text(encoding='utf-8')
    assert "r.role_code='FINANCE' and r.system_role" in sql
    assert "assignment_status='REVOKED'" in sql
    assert 'drop table' not in sql.lower()


def test_acceptance_uses_one_transaction_for_role_and_office_grants(monkeypatch):
    from app.organizations.services import membership_role_service as service
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value=None
    monkeypatch.setattr(service,'engine',engine)
    accepted=Mock(return_value={'id':'inv','role_code':'FINANCE','office_access_scope':'SELECTED_OFFICES','office_ids':['site']})
    upsert=Mock(return_value={'id':'member'});assign=Mock();role=Mock(return_value={'id':'role'})
    grants=Mock(return_value=[])
    monkeypatch.setattr(service,'mark_invitation_accepted',accepted)
    monkeypatch.setattr(service,'upsert_membership',upsert)
    monkeypatch.setattr(service,'assign_role_to_user',assign)
    monkeypatch.setattr(service,'get_role_by_code',role)
    monkeypatch.setattr(service,'list_invitation_office_grants',grants)
    service.sync_membership_with_role('membership','user','clerk_org','agency','finance@example.com')
    for call in (accepted,upsert,assign,role,grants):assert call.call_args.kwargs['connection'] is conn
    assert upsert.call_args.kwargs['office_ids']==['site']
    assert upsert.call_args.kwargs['office_access_scope']=='SELECTED_OFFICES'


def test_replayed_membership_cannot_restore_previous_role_or_suspended_access(monkeypatch):
    from app.organizations.services import membership_role_service as service
    conn=MagicMock()
    conn.execute.return_value.mappings.return_value.first.return_value={'role_code':'FINANCE','status':'SUSPENDED'}
    accepted=Mock();monkeypatch.setattr(service,'mark_invitation_accepted',accepted)
    with pytest.raises(HTTPException) as error:
        service._sync_membership_with_role(conn,'m','user','clerk','agency','x@example.com',None,'MANAGER')
    assert error.value.status_code==403
    accepted.assert_not_called()


def test_scoped_invoice_creation_requires_explicit_office_when_ambiguous():
    from app.api.finance import DocumentCreate,Line,resolve_create_payload
    body=DocumentCreate(document_type='INVOICE',client_id='client',currency='USD',lines=[Line(description='Transport',quantity=1,unit_price=10)])
    with pytest.raises(HTTPException) as error:
        resolve_create_payload(body,{'office_access_scope':'SELECTED_OFFICES','allowed_office_ids':['one','two']})
    assert error.value.detail=='finance_office_selection_required'


def test_revoked_or_missing_invitation_never_falls_back_to_support(monkeypatch):
    from app.organizations.services import membership_role_service as service
    conn=MagicMock();conn.execute.return_value.mappings.return_value.first.return_value=None
    monkeypatch.setattr(service,'mark_invitation_accepted',Mock(return_value=None))
    upsert=Mock();monkeypatch.setattr(service,'upsert_membership',upsert)
    with pytest.raises(HTTPException) as error:
        service._sync_membership_with_role(conn,'m','user','clerk','agency','x@example.com',None,'SUPPORT')
    assert error.value.status_code==403
    upsert.assert_not_called()
