from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.api import organization_network as api
from app.organization_network import repository as repo


PAYLOAD = dict(organization_name="Entrepôt de Kinshasa", office_code="kin-01",
               workspace_kind="WAREHOUSE", country="Congo", country_code="CD",
               city="Kinshasa", currency_code="USD", timezone="Africa/Kinshasa")


def configured_connection(monkeypatch, duplicate=False, role="OWNER"):
    conn = MagicMock()
    def execute(statement, params=None):
        result = MagicMock()
        sql = str(statement)
        result.first.return_value = {"exists": 1} if duplicate and "upper(organization_code)" in sql else None
        result.mappings.return_value.first.return_value = {"network_role": role, "access_scope": "ALL_OFFICES"}
        result.mappings.return_value.one.return_value = {"id": "country-id"}
        return result
    conn.execute.side_effect = execute
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repo, "engine", engine)
    monkeypatch.setattr(repo, "_current_network", lambda *args: {"organization_type": "PARCEL_FREIGHT", "group_id": "own-group"})
    return conn


def test_duplicate_network_code_is_rejected_before_provisioning(monkeypatch):
    conn = configured_connection(monkeypatch, duplicate=True)
    provision = MagicMock()
    monkeypatch.setattr(repo, "provision_organization", provision)
    with pytest.raises(HTTPException) as error:
        repo.create_office("agency", {"user_id": "owner"}, PAYLOAD)
    assert error.value.status_code == 409
    assert error.value.detail == "network_office_code_already_exists"
    provision.assert_not_called()
    checks = [(str(args[0]), args[1]) for args, _ in conn.execute.call_args_list if "upper(organization_code)" in str(args[0])]
    assert len(checks) == 1
    assert "group_id=cast(:group_id as uuid)" in checks[0][0]
    assert checks[0][1] == {"group_id": "own-group", "code": "KIN-01"}


def test_unauthorized_member_cannot_probe_network_codes(monkeypatch):
    configured_connection(monkeypatch, role="OPERATOR")
    check = MagicMock()
    monkeypatch.setattr(repo, "_assert_office_code_available", check)
    with pytest.raises(HTTPException) as error:
        repo.create_office("agency", {"user_id": "staff"}, PAYLOAD)
    assert error.value.status_code == 403
    check.assert_not_called()


def test_creation_checks_only_own_network_and_rechecks_before_final_assignment(monkeypatch):
    conn = configured_connection(monkeypatch)
    monkeypatch.setattr(repo, "provision_organization", lambda **kwargs: {"id": "new-office"})
    monkeypatch.setattr(repo, "sync_membership_with_role", lambda **kwargs: None)
    monkeypatch.setattr(repo, "context", lambda *args: {"offices": []})
    monkeypatch.setattr(repo, "_event", lambda *args: None)
    assert repo.create_office("agency", {"user_id": "owner"}, PAYLOAD) == {"offices": []}
    checks = [args[1] for args, _ in conn.execute.call_args_list if "upper(organization_code)" in str(args[0])]
    assert checks == [{"group_id": "own-group", "code": "KIN-01"}] * 2
    writes = [args[1] for args, _ in conn.execute.call_args_list if "organization_code=:code" in str(args[0])]
    assert writes[0]["code"] == "KIN-01"
    assert writes[0]["parent"] == "agency"


@pytest.mark.parametrize("constraint,code", [
    ("uniq_organizations_code", "network_office_code_unavailable"),
    ("uniq_organizations_network_code", "network_office_code_already_exists"),
])
def test_known_unique_conflicts_are_safe_http_errors(monkeypatch, constraint, code):
    original = SimpleNamespace(diag=SimpleNamespace(constraint_name=constraint))
    def conflict(*args):
        raise IntegrityError("private SQL", {}, original)
    monkeypatch.setattr(repo, "create_office", conflict)
    with pytest.raises(HTTPException) as error:
        api.create_office(api.OfficeCreate(**PAYLOAD), tenant={"org_id": "agency"}, manager={"user_id": "owner"})
    assert error.value.status_code == 409
    assert error.value.detail == code


def test_unrelated_database_errors_are_not_misreported_as_code_conflicts(monkeypatch):
    def conflict(*args):
        raise IntegrityError("SQL", {}, SimpleNamespace(diag=SimpleNamespace(constraint_name="other_constraint")))
    monkeypatch.setattr(repo, "create_office", conflict)
    with pytest.raises(IntegrityError):
        api.create_office(api.OfficeCreate(**PAYLOAD), tenant={"org_id": "agency"}, manager={"user_id": "owner"})
