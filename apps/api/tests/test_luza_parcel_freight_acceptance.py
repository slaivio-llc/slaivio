from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_luza_package_intake_tracking_history_and_notifications_are_operational():
    migration = read("infra/sql/120_parcel_freight_customer_journey.sql")
    repository = read("apps/api/app/packages/repository.py")
    api = read("apps/api/app/api/packages.py")

    for field in (
        "weight_kg", "tracking_id", "client_id", "destination_country",
        "destination_city", "status", "package_events",
    ):
        assert field in repository
    for milestone in (
        '"RECEIVED_AT_ORIGIN"', '"SHIPPED"', '"ARRIVED_DESTINATION"',
        '"READY_FOR_PICKUP"', '"DELIVERED"',
    ):
        assert milestone in repository
    assert "notify_package_milestones" in repository
    assert "notification_outbox" in repository
    assert "public_package_tracking" in api
    assert "/public/packages/tracking/{reference}" in api
    assert "destination_org_id" in migration


def test_luza_departures_manifest_and_customer_announcements_are_connected():
    repository = read("apps/api/app/departures/repository.py")
    api = read("apps/api/app/api/departures.py")

    for feature in (
        "compatible_packages", "allocate_package", "manifest", "_sync_operations",
        "cargo_expeditions", "expedition_packages", "notify_next_departure",
        "parcel_customer_journeys", "notification_outbox",
    ):
        assert feature in repository
    for route in ("compatible-packages", "/packages", "manifest.csv"):
        assert route in api


def test_luza_ai_grounds_answers_in_offices_rates_departures_and_payment_methods():
    repository = read("apps/api/app/ai/repositories/pilot_inbox_ai_repository.py")
    service = read("apps/api/app/ai/services/pilot_inbox_ai_service.py")

    for source in (
        "organization_locations", "organization_location_contacts",
        "shipping_routes", "shipping_services", "service_goods_rates",
        "cargo_departures", "payment_methods",
    ):
        assert source in repository
    assert "parcel_operational_knowledge" in service
    assert "source_kind" in repository and "OPERATIONAL" in repository


def test_luza_finance_dashboard_multi_office_and_client_history_are_exposed():
    dashboard = read("apps/api/app/dashboard/home_repository.py")
    clients = read("apps/api/app/clients/repository.py")
    finance = read("apps/api/app/finance/repository.py")
    package_repository = read("apps/api/app/packages/repository.py")

    for status in ("received", "shipped", "in_transit", "delivered", "waiting"):
        assert status in dashboard
    assert "delivery_rate" in dashboard
    for history_source in ("cargo_packages", "finance_payments", "messages_raw"):
        assert history_source in clients
    for capability in ("finance_documents", "finance_payments", "receipt_number", "balance_due"):
        assert capability in finance
    assert "(p.org_id = :org_id or p.destination_org_id = :org_id)" in package_repository


def test_luza_parcel_navigation_keeps_every_daily_module_available():
    navigation = read("apps/web/dashboard/config/app-navigation.ts")
    for route in (
        "/app/clients", "/app/packages", "/app/departures", "/app/shipments",
        "/app/warehouses", "/app/routes", "/app/inbox", "/app/followups",
        "/app/knowledge", "/app/finance",
    ):
        assert f'href: "{route}"' in navigation
