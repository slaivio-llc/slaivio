from pathlib import Path

from app.api.routes_services import RouteCreate


ROOT = Path(__file__).resolve().parents[3]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_routes_can_target_a_network_office():
    route = RouteCreate(
        route_code="KIN-BXL-AIR",
        route_name="Kinshasa vers Bruxelles",
        destination_org_id="office-bxl",
        origin_country="CD",
        origin_city="Kinshasa",
        destination_country="BE",
        destination_city="Bruxelles",
        transport_mode="AIR",
        eta_min_days=2,
        eta_max_days=5,
    )
    assert route.destination_org_id == "office-bxl"


def test_destination_visibility_is_network_scoped_and_legacy_links_are_repaired():
    migration = source("infra/sql/123_parcel_network_office_visibility.sql").lower()
    repository = source("apps/api/app/packages/repository.py").lower()
    assert "source.group_id = destination.group_id" in migration
    assert "set destination_org_id = null" in migration
    assert "destination_office_outside_organization_network" in repository
    assert "p.org_id = :org_id or p.destination_org_id = :org_id" in repository


def test_destination_office_updates_are_lifecycle_limited():
    repository = source("apps/api/app/packages/repository.py")
    assert "destination_office_transition_not_allowed" in repository
    assert '"acting_org_id":org_id' in repository
