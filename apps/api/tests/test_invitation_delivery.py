from unittest.mock import Mock
from contextlib import nullcontext

import pytest
from fastapi import HTTPException

from app.api import invitations, organization_network
from app.organizations.services import invitation_service


@pytest.fixture(autouse=True)
def isolated_capacity(monkeypatch):
    monkeypatch.setattr(invitation_service,'invitation_capacity',lambda *_:nullcontext(None))
    # These tests isolate delivery. Authorization and office validation have
    # dedicated tests in test_member_access_product.py.
    monkeypatch.setattr(invitation_service,'validate_role_assignment',Mock())
    monkeypatch.setattr(invitation_service,'validate_invitation_office_scope',Mock())


class ClerkResponse:
    def __init__(self, payload: dict, ok: bool = False, status_code: int = 400):
        self.payload = payload
        self.ok = ok
        self.status_code = 200 if ok else status_code

    def json(self):
        return self.payload


def test_completion_logs_the_rejection_reason_without_account_or_ticket_data(monkeypatch, caplog):
    from app.organizations.services import invitation_completion
    denied=Mock(side_effect=HTTPException(403,'invitation_membership_not_confirmed'))
    monkeypatch.setattr(invitation_completion,'complete_invitation',denied)
    with pytest.raises(HTTPException):
        invitations.complete_invitation(invitations.CompleteInvitationRequest(org_id='private-agency'),
                                        {'user_id':'private-user','email':'private@example.com'})
    assert 'reason=invitation_membership_not_confirmed status=403' in caplog.text
    assert 'private-agency' not in caplog.text
    assert 'private@example.com' not in caplog.text
    assert 'private-user' not in caplog.text


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
    sent = invitation_service.requests.post.call_args.kwargs["json"]
    assert sent["role"] == "org:member"
    assert sent["redirect_url"].endswith('/join?agency=org-1')


@pytest.mark.parametrize("code,status,expected", [
    ("organization_slugs_disabled", 403, "clerk_organization_slugs_disabled"),
    ("organization_invitation_not_unique", 400, "invitation_already_pending"),
    ("organization_membership_quota_exceeded", 403, "invitation_member_limit_reached"),
    ("resource_not_found", 404, "invitation_organization_not_found"),
    ("authentication_invalid", 401, "invitation_provider_configuration_invalid"),
    ("rate_limit_exceeded", 429, "invitation_rate_limited"),
])
def test_provider_errors_are_actionable_and_do_not_create_local_invitations(monkeypatch, code, status, expected):
    save = Mock()
    monkeypatch.setattr(invitation_service, "CLERK_SECRET_KEY", "test-secret")
    monkeypatch.setattr(invitation_service, "create_invitation_record", save)
    monkeypatch.setattr(invitation_service.requests, "post", Mock(return_value=ClerkResponse({"errors": [{"code": code}]}, status_code=status)))
    with pytest.raises(invitation_service.InvitationProviderError) as error:
        invitation_service.invite_user_to_org("agency", "org_real", "agent@example.com", "OPERATOR")
    assert error.value.detail == expected
    save.assert_not_called()


def test_missing_secret_never_pretends_an_email_was_delivered(monkeypatch):
    monkeypatch.setattr(invitation_service, "CLERK_SECRET_KEY", None)
    post, save = Mock(), Mock()
    monkeypatch.setattr(invitation_service.requests, "post", post)
    monkeypatch.setattr(invitation_service, "create_invitation_record", save)
    with pytest.raises(invitation_service.InvitationProviderError) as error:
        invitation_service.invite_user_to_org("agency", "org_real", "agent@example.com", "OPERATOR")
    assert error.value.detail == "invitation_provider_not_configured"
    post.assert_not_called()
    save.assert_not_called()


@pytest.mark.parametrize('local_id', ['personal_user_owner', 'office_'+'a'*32, 'org_'+'b'*32])
def test_local_agency_is_linked_without_giving_the_inviter_owner_access(monkeypatch, local_id):
    monkeypatch.setattr(invitation_service, "CLERK_SECRET_KEY", "test-secret")
    connection = Mock()
    monkeypatch.setattr(invitation_service, "organization_clerk_link_lock", lambda _: nullcontext((
        {"clerk_org_id": local_id, "organization_name": "Cargo"}, "user_owner", connection,
    )))
    monkeypatch.setattr(invitation_service.requests, "get", Mock(return_value=ClerkResponse({}, status_code=404)))
    post = Mock(side_effect=[ClerkResponse({"id": "org_real", "private_metadata": {"slaivio_org_id": "agency"}}, ok=True), ClerkResponse({"id": "inv_1"}, ok=True)])
    monkeypatch.setattr(invitation_service.requests, "post", post)
    link, save = Mock(), Mock(return_value={"id": "local-inv"})
    monkeypatch.setattr(invitation_service, "link_clerk_organization", link)
    monkeypatch.setattr(invitation_service, "create_invitation_record", save)
    invitation_service.invite_user_to_org("agency", local_id, " AGENT@example.com ", "FINANCE", invited_by_id="user_manager")
    assert post.call_args_list[0].kwargs["json"]["created_by"] == "user_owner"
    assert post.call_args_list[1].args[0].endswith("/organizations/org_real/invitations")
    assert post.call_args_list[1].kwargs["json"]["role"] == "org:member"
    link.assert_called_once_with("agency", "org_real", connection=connection)
    assert save.call_args.kwargs["role_code"] == "FINANCE"
    assert save.call_args.kwargs["email"] == "agent@example.com"


def test_stale_local_context_reuses_existing_canonical_link(monkeypatch):
    monkeypatch.setattr(invitation_service, "organization_clerk_link_lock", lambda _: nullcontext(({"clerk_org_id": "org_real"}, "user_owner", Mock())))
    get = Mock()
    monkeypatch.setattr(invitation_service.requests, "get", get)
    assert invitation_service._ensure_clerk_organization("agency", "personal_user_owner") == "org_real"
    get.assert_not_called()


def test_existing_remote_slug_is_recovered_only_if_it_belongs_to_this_agency(monkeypatch):
    monkeypatch.setattr(invitation_service, "organization_clerk_link_lock", lambda _: nullcontext(({"clerk_org_id": "personal_user"}, "owner", Mock())))
    monkeypatch.setattr(invitation_service.requests, "get", Mock(return_value=ClerkResponse({"id": "org_other", "private_metadata": {"slaivio_org_id": "another-agency"}}, ok=True)))
    link = Mock()
    monkeypatch.setattr(invitation_service, "link_clerk_organization", link)
    with pytest.raises(invitation_service.InvitationProviderError) as error:
        invitation_service._ensure_clerk_organization("agency", "personal_user")
    assert error.value.detail == "invitation_organization_link_invalid"
    link.assert_not_called()


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
