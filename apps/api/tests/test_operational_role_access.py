from pathlib import Path
import re
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from app.organizations.services import operational_role_policy as policy
from app.permissions.services import permission_service
from app.api.organization_network import NetworkInvitation, OfficeGrant
from pydantic import ValidationError
from app.organizations.services.staff_roles import STAFF_ROLES
from app.api.invitations import InviteUserRequest


def test_migration_and_new_agencies_use_the_same_explicit_matrix():
    sql = (Path(__file__).resolve().parents[3] / 'infra/sql/164_operational_member_access.sql').read_text(encoding='utf-8')
    rows = re.findall(r"\('([A-Z_]+)','([^']*)','([^']*)',\s*'([^']*)'\)", sql)
    assert {code: (name, description, permissions) for code, name, description, permissions in rows} == policy.OPERATIONAL_ROLES
    assert 'where organization_roles.system_role' in sql
    assert 'where r.system_role on conflict' in sql
    assert 'update organization_memberships' not in sql
    assert 'delete from organization_roles' not in sql


@pytest.mark.parametrize('role', policy.OPERATIONAL_ROLES)
def test_operational_staff_never_get_administration_or_finance(role, monkeypatch):
    permissions = set(policy.OPERATIONAL_ROLES[role][2].split())
    assert not any(code.startswith(('platform.', 'quarantine.', 'network.', 'billing.', 'finance.', 'team.', 'roles.', 'settings.')) for code in permissions)
    assert not {'organization.manage', 'pickups.override', 'pickups.settings', 'inbox.ai.manage'} & permissions
    monkeypatch.setattr(permission_service, 'user_has_permission',
                        lambda **kwargs: kwargs['permission_code'] in permissions)
    for forbidden in ('finance.payments', 'team.write', 'billing.manage', 'platform.admin.read', 'pickups.override'):
        with pytest.raises(HTTPException) as error:
            permission_service.assert_permission('staff', 'bureau', forbidden)
        assert error.value.status_code == 403


def test_roles_are_distinct_and_least_privilege():
    rights = {code: set(value[2].split()) for code, value in policy.OPERATIONAL_ROLES.items()}
    assert {'packages.create', 'packages.pricing', 'shipments.create'} <= rights['OPERATOR']
    assert {'inbox.read', 'inbox.reply', 'inbox.manage'} <= rights['SUPPORT']
    assert not {'packages.update', 'shipments.update', 'clients.export'} & rights['SUPPORT']
    assert 'warehouses.create' not in rights['WAREHOUSE']
    assert 'warehouses.create' in rights['WAREHOUSE_SUPERVISOR']
    assert rights['WEIGHER'] == {'packages.read', 'warehouses.read', 'warehouses.weigh'}
    assert 'pickups.release' not in rights['CASHIER']
    assert 'pickups.release' in rights['COUNTER_AGENT']


def test_provisioning_is_scoped_to_standard_roles_and_one_agency(monkeypatch):
    engine = MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(policy, 'engine', engine)
    policy.ensure_operational_role_permissions('matadi')
    assert conn.execute.call_count == len(policy.OPERATIONAL_ROLES) * 3
    for call in conn.execute.call_args_list:
        statement, params = call.args
        assert params['org'] == 'matadi'
        assert params['code'] in policy.OPERATIONAL_ROLES
        assert 'system_role' in str(statement)
        assert params['permissions'] == policy.OPERATIONAL_ROLES[params['code']][2].split()


@pytest.mark.parametrize('role', STAFF_ROLES)
def test_staff_roles_can_be_invited_and_granted_network_offices(role):
    assert InviteUserRequest(email='staff@example.com', role_code=role).role_code == role
    assert NetworkInvitation(email='staff@example.com', office_ids=['bureau'], role_code=role).role_code == role
    assert OfficeGrant(user_id='user_staff', office_ids=['bureau'], role_code=role).role_code == role


@pytest.mark.parametrize('role', ['OWNER', 'PLATFORM_ADMIN', 'UNKNOWN', 'CUSTOM', 'WAREHOUSE_SUPERVISOR', 'RECEIVER', 'WEIGHER', 'QUALITY_CONTROLLER', 'COUNTER_AGENT', 'CASHIER'])
def test_network_invitation_cannot_assign_owner_or_unknown_roles(role):
    with pytest.raises(ValidationError):
        NetworkInvitation(email='staff@example.com', office_ids=['bureau'], role_code=role)
    with pytest.raises(ValidationError):
        InviteUserRequest(email='staff@example.com', role_code=role)
    with pytest.raises(ValidationError):
        OfficeGrant(user_id='user_staff', office_ids=['bureau'], role_code=role)


@pytest.mark.parametrize('role', ['OWNER', 'RECEIVER', 'CUSTOM', 'CASHIER'])
def test_direct_service_calls_reject_retired_assignments_before_io(role, monkeypatch):
    from app.organizations.services import invitation_service
    from app.organization_network import repository
    post = MagicMock()
    monkeypatch.setattr(invitation_service.requests, 'post', post)
    for operation in (
        lambda: invitation_service.invite_user_to_org('bureau', 'org_real', 'staff@example.com', role),
        lambda: repository.grant_offices('bureau', 'owner', 'staff', ['bureau'], role),
    ):
        with pytest.raises(HTTPException) as error:
            operation()
        assert error.value.detail == 'staff_role_not_available'
    post.assert_not_called()
