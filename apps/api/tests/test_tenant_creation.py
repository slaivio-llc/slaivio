from app.tenant.services import tenant_service
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_create_tenant_provisions_owner_and_selects_it(monkeypatch):
    calls = {}

    monkeypatch.setattr(
        tenant_service,
        "provision_organization",
        lambda clerk_org_id, organization_name: {
            "id": clerk_org_id,
            "organization_name": organization_name,
        },
    )
    monkeypatch.setattr(
        tenant_service,
        "sync_membership_with_role",
        lambda **kwargs: calls.setdefault("membership", kwargs),
    )
    monkeypatch.setattr(
        tenant_service,
        "set_active_tenant",
        lambda **kwargs: calls.setdefault("session", kwargs),
    )
    monkeypatch.setattr(
        tenant_service,
        "get_active_tenant",
        lambda user_id: {"org_id": calls["session"]["org_id"], "clerk_user_id": user_id},
    )

    result = tenant_service.create_tenant(
        {"user_id": "user_1", "email": "owner@example.test", "name": "Owner"},
        "  Slaivio Europe  ",
    )

    assert result["organization"]["organization_name"] == "Slaivio Europe"
    assert result["active_tenant"]["clerk_user_id"] == "user_1"
    assert calls["membership"]["default_role_code"] == "OWNER"
    assert calls["membership"]["org_id"] == calls["session"]["org_id"]


def test_create_tenant_rejects_blank_name():
    try:
        tenant_service.create_tenant({"user_id": "user_1"}, " ")
    except ValueError as exc:
        assert str(exc) == "organization_name_required"
    else:
        raise AssertionError("A blank organization name must be rejected")


def test_new_organizations_receive_all_owner_tabs_and_existing_ones_are_repaired():
    provisioning = (ROOT / "apps/api/app/organizations/services/provisioning_service.py").read_text(encoding="utf-8")
    repair = (ROOT / "infra/sql/117_organization_owner_permission_repair.sql").read_text(encoding="utf-8")
    assert "ensure_owner_permissions(org_id)" in provisioning
    assert "permission.permission_code not like 'platform.%'" in provisioning
    assert "role.role_code = 'OWNER'" in repair
    assert "permission.permission_code not like 'platform.%'" in repair
