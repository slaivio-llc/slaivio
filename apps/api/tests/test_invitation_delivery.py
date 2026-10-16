from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.api import invitations, organization_network
from app.organizations.services import invitation_service


class ClerkResponse:
    def __init__(self, payload: dict, ok: bool = False):
        self.payload = payload
        self.ok = ok

    def json(self):
        return self.payload


def test_invitation_reports_clerk_organizations_feature_disabled(monkeypatch):
    save_record = Mock()
    monkeypatch.setattr(invitation_service, "CLERK_SECRET_KEY", "test-secret")
    monkeypatch.setattr(
        invitation_service.requests,
        "post",
        Mock(return_value=ClerkResponse({
            "errors": [{
                "code": "organization_not_enabled_in_instance",
                "long_message": "Provider diagnostic details",
            }]
        })),
    )
    monkeypatch.setattr(invitation_service, "create_invitation_record", save_record)

    with pytest.raises(invitation_service.InvitationProviderError) as error:
        invitation_service.invite_user_to_org(
            org_id="org-1",
            clerk_org_id="clerk-org-1",
            email="member@example.com",
            role_code="OPERATOR",
        )

    assert error.value.detail == "clerk_organizations_not_enabled"
    assert error.value.status_code == 503
    assert "Provider diagnostic details" not in str(error.value)
    save_record.assert_not_called()


def test_invitation_uses_clerk_response_id_and_persists_on_success(monkeypatch):
    save_record = Mock(return_value={"id": "invite-1"})
    monkeypatch.setattr(invitation_service, "CLERK_SECRET_KEY", "test-secret")
    monkeypatch.setattr(
        invitation_service.requests,
        "post",
        Mock(return_value=ClerkResponse({"id": "clerk-invite-1"}, ok=True)),
    )
    monkeypatch.setattr(invitation_service, "create_invitation_record", save_record)

    result = invitation_service.invite_user_to_org(
        org_id="org-1",
        clerk_org_id="clerk-org-1",
        email="member@example.com",
        role_code="OPERATOR",
    )

    assert result["invitation"] == {"id": "invite-1"}
    save_record.assert_called_once()
    assert save_record.call_args.kwargs["clerk_invitation_id"] == "clerk-invite-1"


@pytest.mark.parametrize(
    ("api_module", "request_body", "prepare"),
    [
        (
            invitations,
            invitations.InviteUserRequest(email="member@example.com", role_code="OPERATOR"),
            lambda monkeypatch: monkeypatch.setattr(
                invitations,
                "get_organization",
                lambda _org_id: {"clerk_org_id": "clerk-org-1"},
            ),
        ),
        (
            organization_network,
            organization_network.NetworkInvitation(
                email="member@example.com",
                office_ids=["office-1"],
                role_code="OPERATOR",
            ),
            lambda monkeypatch: (
                monkeypatch.setattr(
                    organization_network.repo,
                    "validate_invitation_offices",
                    lambda *_args: None,
                ),
                monkeypatch.setattr(
                    organization_network,
                    "get_organization",
                    lambda _org_id: {"clerk_org_id": "clerk-org-1"},
                ),
            ),
        ),
    ],
)
def test_invitation_endpoints_return_actionable_provider_status(
    monkeypatch, api_module, request_body, prepare
):
    prepare(monkeypatch)
    monkeypatch.setattr(
        api_module,
        "invite_user_to_org",
        Mock(side_effect=invitation_service.InvitationProviderError(
            "clerk_organizations_not_enabled", 503
        )),
    )
    tenant = {"org_id": "org-1", "clerk_org_id": "clerk-org-1"}
    manager = {"id": "user-1", "user_id": "user-1", "name": "Agency manager"}

    with pytest.raises(HTTPException) as error:
        if api_module is invitations:
            api_module.invite_user(request_body, manager, tenant)
        else:
            api_module.invite_network_member(request_body, tenant, manager)

    assert error.value.status_code == 503
    assert error.value.detail == "clerk_organizations_not_enabled"
