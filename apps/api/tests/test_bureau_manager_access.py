from pathlib import Path
from unittest.mock import MagicMock,Mock

import pytest
from fastapi import HTTPException

from app.organizations.services import manager_policy as policy,access_policy
from app.tenant.services import tenant_service
from app.dashboard.cargo_overview import cargo_overview


@pytest.mark.parametrize('permission',[
    'clients.read','clients.update','packages.read','packages.create','packages.delivery',
    'shipments.read','shipments.update','warehouses.read','warehouses.receive',
    'pickups.release','departures.dispatch','batches.read','tracking.notify',
    'finance.read','finance.create','finance.payments','finance.export','finance.void',
    'analytics.read','reports.export','inbox.read','inbox.reply','followups.execute',
    'pricing.read','services.manage','documents.settings','organization.read',
    'team.read','team.write','team.manage','roles.manage','locations.access.manage',
])
def test_manager_can_manage_bureau_business(permission):
    assert policy.manager_permission_allowed(permission)


@pytest.mark.parametrize('permission',[
    'organization.manage','network.read','network.overview','network.members.manage',
    'network.offices.manage','billing.manage','security.manage','data.manage',
    'developers.manage','platform.admin.read','platform.permissions.manage',
    'quarantine.replay','wallet.write','future.root_access',
])
def test_manager_is_not_a_network_or_platform_owner(permission):
    assert not policy.manager_permission_allowed(permission)


def test_provisioning_reconciles_only_standard_manager_in_current_bureau(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(policy,'engine',engine)
    policy.ensure_manager_role_permissions('matadi')
    assert conn.execute.call_count==2
    for statement,params in [call.args for call in conn.execute.call_args_list]:
        assert 'r.org_id=:org' in str(statement)
        assert "r.role_code='MANAGER' and r.system_role" in str(statement)
        assert params['org']=='matadi'
        assert params['families']==list(policy.MANAGER_PERMISSION_FAMILIES)


def test_migration_and_runtime_grant_the_same_policy():
    import re
    sql=(Path(__file__).resolve().parents[3]/'infra/sql/162_bureau_manager_access.sql').read_text(encoding='utf-8')
    families=re.search(r"split_part\(permission_code,'\.',1\) in \((.*?)\)",sql,re.S)
    specific=re.search(r'or permission_code in \((.*?)\)',sql,re.S)
    assert families and specific
    assert set(re.findall("'([^']+)'",families[1]))==set(policy.MANAGER_PERMISSION_FAMILIES)
    assert set(re.findall("'([^']+)'",specific[1]))==set(policy.MANAGER_SPECIFIC_PERMISSIONS)
    assert "where role_code='MANAGER' and system_role" in sql
    assert 'update organization_memberships' not in sql


def test_manager_cannot_use_aggregated_network_dashboard():
    with pytest.raises(HTTPException) as error:
        cargo_overview({'org_id':'matadi','user_id':'manager'},['packages.read','finance.read'],scope='network')
    assert error.value.status_code==403
    assert error.value.detail=='network_overview_required'


def test_legacy_home_cannot_bypass_the_network_dashboard_permission(monkeypatch):
    from app.api import dashboard
    monkeypatch.setattr(dashboard,'_resolve_active_tenant',lambda *_:{'org_id':'matadi'})
    monkeypatch.setattr(dashboard,'list_permissions_for_user',lambda **_ :['packages.read','analytics.read'])
    load=Mock();monkeypatch.setattr(dashboard,'get_home',load)
    with pytest.raises(HTTPException) as error:
        dashboard.dashboard_home('network',{'user_id':'manager'})
    assert error.value.status_code==403
    load.assert_not_called()


def test_manager_cannot_switch_to_an_unassigned_bureau(monkeypatch):
    monkeypatch.setattr(tenant_service,'list_user_tenants',lambda *_:[{'org_id':'matadi'}])
    switch=Mock();monkeypatch.setattr(tenant_service,'set_active_tenant',switch)
    with pytest.raises(PermissionError):tenant_service.switch_tenant('manager','kinshasa')
    switch.assert_not_called()


def test_client_directory_refuses_another_bureau_even_with_all_client_permissions(monkeypatch):
    from app.clients import directory_scope
    monkeypatch.setattr(directory_scope,'list_permissions_for_user',lambda *_:['clients.read','clients.export','clients.update'])
    with pytest.raises(HTTPException) as error:
        directory_scope.resolve_scope({'org_id':'matadi','user_id':'manager'},'kinshasa')
    assert error.value.detail=='client_office_access_denied'
    assert directory_scope.resolve_scope({'org_id':'matadi','user_id':'manager'},'all')==['matadi']


def test_manager_cannot_invite_an_owner(monkeypatch):
    engine=MagicMock();conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.scalar.side_effect=['owner-role','MANAGER']
    monkeypatch.setattr(access_policy,'engine',engine)
    with pytest.raises(HTTPException) as error:
        access_policy.validate_role_assignment('matadi','manager','OWNER')
    assert error.value.detail=='owner_role_assignment_required'
