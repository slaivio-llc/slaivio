from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.organization_admin import LocationSave
from app.core.office_context import office_scope_ids, validate_office_assignment
from app.organization_admin import repository
from app.packages import repository as packages_repository
from app.pickups import repository as pickups_repository


def test_office_request_requires_only_name_country_and_city():
    office = LocationSave.model_validate({'name': "Bureau de Bobo-Dioulasso", 'country': "Burkina Faso", 'city': "Bobo-Dioulasso"})

    assert office.location_type == "OFFICE"
    assert office.code is None
    assert office.address is None
    assert office.phone is None
    assert office.opening_hours == {}


@pytest.mark.parametrize("missing", ["name", "country", "city"])
def test_office_request_requires_core_location_fields(missing):
    payload = {
        "name": "Bureau de Bobo-Dioulasso",
        "country": "Burkina Faso",
        "city": "Bobo-Dioulasso",
    }
    payload.pop(missing)

    with pytest.raises(ValidationError):
        LocationSave.model_validate({**payload})


def test_duplicate_active_office_is_rejected_without_writing(monkeypatch):
    connection = MagicMock()
    no_code_conflict = MagicMock()
    no_code_conflict.first.return_value = None
    duplicate_office = MagicMock()
    duplicate_office.first.return_value = {"id": "existing-office"}
    connection.execute.side_effect = [no_code_conflict, duplicate_office]
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = connection
    monkeypatch.setattr(repository, "engine", engine)

    with pytest.raises(HTTPException) as error:
        repository.save_location(
            "agency-1",
            "user-1",
            {
                "name": "Bureau de Bobo-Dioulasso",
                "code": None,
                "location_type": "OFFICE",
                "country": "Burkina Faso",
                "city": "Bobo-Dioulasso",
            },
        )

    assert error.value.status_code == 409
    assert error.value.detail == "office_already_exists"
    assert connection.execute.call_count == 2


def test_office_code_is_generated_and_optional_fields_are_preserved(monkeypatch):
    connection = MagicMock()
    code_result = MagicMock()
    code_result.first.return_value = None
    duplicate_result = MagicMock()
    duplicate_result.first.return_value = None
    saved_result = MagicMock()
    saved_result.mappings.return_value.first.return_value = {
        "id": "location-1",
        "agency_office_id": None,
        "code": "OFF-0123456789AB",
    }
    loaded_result = MagicMock()
    loaded_result.mappings.return_value.one.return_value = {
        "id": "location-1",
        "agency_office_id": "operational-office-1",
        "code": "OFF-0123456789AB",
    }
    connection.execute.side_effect = [
        code_result, duplicate_result, saved_result, loaded_result, MagicMock()
    ]
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = connection
    monkeypatch.setattr(repository, "engine", engine)

    office = repository.save_location(
        "agency-1",
        "user-1",
        {
            "name": "Bureau de Bobo-Dioulasso",
            "code": None,
            "location_type": "OFFICE",
            "country": " Burkina Faso ",
            "city": " Bobo-Dioulasso ",
            "address": None,
            "phone": "+226 70 00 00 00",
            "opening_hours": {"text": "Lun-Sam, 08:00-17:00"},
            "timezone": "UTC",
            "services": [],
        },
    )

    insert_statement, insert_params = connection.execute.call_args_list[2].args
    assert "insert into organization_locations" in str(insert_statement)
    assert insert_params["code"].startswith("OFF-")
    assert insert_params["country"] == "Burkina Faso"
    assert insert_params["city"] == "Bobo-Dioulasso"
    assert office["agency_office_id"] == "operational-office-1"


def test_canonical_office_migration_preserves_operational_references():
    from pathlib import Path

    migration = Path(__file__).parents[3] / "infra" / "sql" / "129_organization_offices_canonical.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "organization_location_id" in sql
    assert "agency_office_id" in sql
    assert "references organization_locations(id)" in sql
    assert "create trigger trg_sync_agency_office_from_location" in sql
    assert "is_active = new.status = 'ACTIVE'" in sql
    assert "delete from agency_offices" not in sql.lower()


def test_office_sync_trigger_targets_the_existing_partial_unique_index():
    from pathlib import Path

    migrations = Path(__file__).parents[3] / "infra" / "sql"
    for migration_name in (
        "129_organization_offices_canonical.sql",
        "132_fix_office_location_sync_conflict.sql",
    ):
        sql = (migrations / migration_name).read_text(encoding="utf-8").lower()
        assert "on conflict (organization_location_id)" in sql
        assert "where organization_location_id is not null" in sql


def test_office_context_filters_to_selected_office_before_grants():
    context = {
        "office_access_scope": "ALL_OFFICES",
        "selected_office_id": "office-bobo",
        "allowed_office_ids": ["office-bobo", "office-ouaga"],
    }

    assert office_scope_ids(context) == ["office-bobo"]


def test_selected_office_membership_uses_all_grants_when_no_context_is_selected():
    context = {
        "office_access_scope": "SELECTED_OFFICES",
        "selected_office_id": None,
        "allowed_office_ids": ["office-bobo", "office-ouaga"],
    }

    assert office_scope_ids(context) == ["office-bobo", "office-ouaga"]


def test_unrestricted_membership_keeps_existing_unfiltered_access():
    context = {
        "office_access_scope": "ALL_OFFICES",
        "selected_office_id": None,
        "allowed_office_ids": ["office-bobo"],
    }

    assert office_scope_ids(context) is None
    validate_office_assignment(context, None, None)


def test_restricted_member_must_assign_operation_to_an_authorized_office():
    context = {
        "office_access_scope": "SELECTED_OFFICES",
        "selected_office_id": None,
        "allowed_office_ids": ["office-bobo"],
    }

    validate_office_assignment(context, "office-ouaga", "office-bobo")
    with pytest.raises(HTTPException) as error:
        validate_office_assignment(context, "office-ouaga", None)

    assert error.value.status_code == 403
    assert error.value.detail == "office_access_denied"


def test_package_access_requires_intersection_with_authorized_offices(monkeypatch):
    package_id = "00000000-0000-0000-0000-000000000001"
    connection = MagicMock()
    result = MagicMock()
    result.scalars.return_value = iter([package_id])
    connection.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(packages_repository, "engine", engine)

    assert packages_repository.package_matches_office_scope(
        "agency-1", package_id, ["office-bobo"]
    )

    statement, params = connection.execute.call_args.args
    assert "office.id in (p.origin_location_id,p.destination_location_id)" in str(statement)
    assert params == {
        "org_id": "agency-1",
        "package_ids": [package_id],
        "office_ids": ["office-bobo"],
    }


def test_forged_office_header_is_rejected_for_selected_office_member(monkeypatch):
    connection = MagicMock()
    member_result = MagicMock()
    member_result.mappings.return_value.first.return_value = {
        "id": "membership-1",
        "role_code": "AGENT",
        "office_access_scope": "SELECTED_OFFICES",
    }
    locations_result = [
        SimpleNamespace(
            _mapping={
                "location_id": "office-bobo",
                "name": "Bobo-Dioulasso",
                "country": "Burkina Faso",
                "city": "Bobo-Dioulasso",
                "address": None,
                "phone": None,
                "opening_hours": {},
                "status": "ACTIVE",
            }
        )
    ]
    connection.execute.side_effect = [member_result, locations_result]
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(repository, "engine", engine)

    with pytest.raises(HTTPException) as error:
        repository.office_context("agency-1", "user-1", "office-ouaga")

    assert error.value.status_code == 403
    assert error.value.detail == "office_access_denied"


def test_pickup_office_access_maps_legacy_office_to_canonical_location(monkeypatch):
    pickup_id = "00000000-0000-0000-0000-000000000002"
    connection = MagicMock()
    result = MagicMock()
    result.scalar_one.return_value = True
    connection.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(pickups_repository, "engine", engine)

    assert pickups_repository.pickup_matches_office_scope(
        "agency-1", pickup_id, ["00000000-0000-0000-0000-000000000003"]
    )

    statement, params = connection.execute.call_args.args
    assert "organization_locations office" in str(statement)
    assert "office.id=any(cast(:office_ids as uuid[]))" in str(statement)
    assert params == {
        "id": pickup_id,
        "o": "agency-1",
        "office_ids": ["00000000-0000-0000-0000-000000000003"],
    }


def test_pickup_creation_accepts_canonical_or_legacy_office_reference(monkeypatch):
    connection = MagicMock()
    result = MagicMock()
    result.mappings.return_value.first.return_value = {
        "operational_office_id": "00000000-0000-0000-0000-000000000004",
        "location_id": "00000000-0000-0000-0000-000000000005",
    }
    connection.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(pickups_repository, "engine", engine)

    resolved = pickups_repository.resolve_office_reference(
        "agency-1", "00000000-0000-0000-0000-000000000004"
    )

    assert resolved == {
        "operational_office_id": "00000000-0000-0000-0000-000000000004",
        "location_id": "00000000-0000-0000-0000-000000000005",
    }
    statement, params = connection.execute.call_args.args
    assert "organization_location_id=cast(:id as uuid)" in str(statement)
    assert params == {
        "o": "agency-1",
        "id": "00000000-0000-0000-0000-000000000004",
    }
