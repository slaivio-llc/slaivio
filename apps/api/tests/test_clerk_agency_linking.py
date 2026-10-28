import asyncio
from unittest.mock import AsyncMock, Mock

from app.api import clerk_webhooks as hooks


def deliver(monkeypatch, event):
    monkeypatch.setattr(hooks, "SECRET", "test-webhook-secret")
    verifier = Mock()
    verifier.verify.return_value = event
    monkeypatch.setattr(hooks, "Webhook", Mock(return_value=verifier))
    request = Mock(headers={})
    request.body = AsyncMock(return_value=b"signed-event")
    return asyncio.run(hooks.clerk_webhook(request))


def test_backend_created_clerk_organization_links_to_the_existing_agency(monkeypatch):
    monkeypatch.setattr(hooks, "get_organization", Mock(return_value={"id": "agency"}))
    link = Mock(return_value={"id": "agency", "clerk_org_id": "org_real"})
    provision = Mock()
    monkeypatch.setattr(hooks, "link_clerk_organization", link)
    monkeypatch.setattr(hooks, "provision_organization", provision)
    result = deliver(monkeypatch, {"type": "organization.created", "data": {
        "id": "org_real", "name": "Cargo", "private_metadata": {"slaivio_org_id": "agency"},
    }})
    assert isinstance(result["organization"], dict)
    assert result["organization"]["id"] == "agency"
    link.assert_called_once_with("agency", "org_real")
    provision.assert_not_called()


def test_creator_webhook_preserves_the_slaivio_owner_role(monkeypatch):
    monkeypatch.setattr(hooks, "get_organization_by_clerk_org_id", Mock(return_value={"id": "agency"}))
    monkeypatch.setattr(hooks, "get_organization_member", Mock(return_value={"role_code": "OWNER", "status": "ACTIVE"}))
    sync = Mock(return_value={})
    monkeypatch.setattr(hooks, "sync_membership_with_role", sync)
    deliver(monkeypatch, {"type": "organizationMembership.created", "data": {
        "id": "membership", "organization": {"id": "org_real"},
        "public_user_data": {"user_id": "user_owner", "identifier": "owner@example.com"},
    }})
    assert sync.call_args.kwargs["default_role_code"] == "OWNER"


def test_membership_webhook_cannot_reactivate_a_suspended_member(monkeypatch):
    monkeypatch.setattr(hooks, "get_organization_by_clerk_org_id", Mock(return_value={"id": "agency"}))
    monkeypatch.setattr(hooks, "get_organization_member", Mock(return_value={"role_code": "OPERATOR", "status": "SUSPENDED"}))
    sync = Mock()
    monkeypatch.setattr(hooks, "sync_membership_with_role", sync)
    result = deliver(monkeypatch, {"type": "organizationMembership.updated", "data": {
        "id": "membership", "organization": {"id": "org_real"},
        "public_user_data": {"user_id": "user_agent"},
    }})
    assert result["reason"] == "membership_inactive"
    sync.assert_not_called()


def test_replayed_user_created_does_not_restore_the_old_local_clerk_id(monkeypatch):
    monkeypatch.setattr(hooks, "get_organization", Mock(return_value={"id": "personal_user_owner", "clerk_org_id": "org_real"}))
    provision, sync = Mock(), Mock(return_value={})
    monkeypatch.setattr(hooks, "provision_organization", provision)
    monkeypatch.setattr(hooks, "sync_membership_with_role", sync)
    deliver(monkeypatch, {"type": "user.created", "data": {"id": "user_owner", "email_addresses": []}})
    assert sync.call_args.kwargs["clerk_org_id"] == "org_real"
    provision.assert_not_called()
