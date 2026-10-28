from pathlib import Path

import pytest
from pydantic import ValidationError

from app.api.routes_services import RouteCreate
from app.api.service_catalog import ServiceCreate

ROOT = Path(__file__).resolve().parents[3]


def test_route_requires_cities_and_at_least_one_service_but_not_physical_offices():
    route = RouteCreate(
        origin_country="China",
        origin_city="Guangzhou",
        destination_country="DR Congo",
        destination_city="Kinshasa",
        service_ids=["service-air", "service-sea"],
    )

    assert route.origin_location_id is None
    assert route.destination_location_id is None
    assert route.route_name is None
    assert route.service_ids == ["service-air", "service-sea"]

    with pytest.raises(ValidationError):
        RouteCreate(
            origin_country="China",
            origin_city="Guangzhou",
            destination_country="DR Congo",
            destination_city="Kinshasa",
            service_ids=[],
        )


def test_routes_and_services_use_the_canonical_many_to_many_offerings():
    api = (ROOT / "apps/api/app/api/routes_services.py").read_text(encoding="utf-8")
    routes = (ROOT / "apps/api/app/routes_services/repository.py").read_text(encoding="utf-8")
    services = (ROOT / "apps/api/app/service_catalog/repository.py").read_text(encoding="utf-8")
    pricing = (ROOT / "apps/api/app/pricing_engine/repository.py").read_text(encoding="utf-8")
    migration = (ROOT / "infra/sql/131_module_09_service_route_offerings.sql").read_text(encoding="utf-8")

    assert 'service_ids:list[str]=Field(min_length=1)' in api
    assert 'def available_services(o):' in routes
    assert 'insert into service_route_offerings' in routes
    assert 'offering.route_id=r.id' in routes
    assert "x.availability in('AVAILABLE','LIMITED','QUOTE_ONLY')" in services
    assert "r.status in('ACTIVE','LIMITED')" in services
    assert 'service_route_offerings x' in pricing
    assert 'on conflict (service_id, route_id, workspace_id) do nothing' in migration


def test_new_service_name_is_free_and_transport_is_an_explicit_choice():
    service = ServiceCreate(service_name="Express", description="Livraison rapide.")
    ui = (
        ROOT
        / "apps/web/dashboard/components/settings/organization-transport-settings.tsx"
    ).read_text(encoding="utf-8")
    repository = (ROOT / "apps/api/app/service_catalog/repository.py").read_text(encoding="utf-8")

    assert service.service_code is None
    assert service.shipping_mode == "AIR"
    assert "unicodedata.normalize" in repository
    assert "status,availability" in repository
    assert 'name="service_name"' in ui
    assert 'name="shipping_mode"' in ui
    assert '<option value="AIR">Transport aérien</option>' in ui
    assert '<option value="SEA">Transport maritime</option>' in ui
