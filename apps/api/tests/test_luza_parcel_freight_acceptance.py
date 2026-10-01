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


def test_luza_departure_allocation_explains_blockers_and_manifest_is_operational():
    repository = read("apps/api/app/departures/repository.py")
    api = read("apps/api/app/api/departures.py")
    page = read("apps/web/dashboard/components/departures/departures-page.tsx")

    for rule in (
        "PAYMENT_NOT_CLEARED", "GOODS_PROHIBITED", "MISSING_DOCUMENTS",
        "WAREHOUSE_MISMATCH", "SERVICE_MISMATCH", "ROUTE_MISMATCH",
        "WEIGHT_CAPACITY_EXCEEDED", "VOLUME_CAPACITY_EXCEEDED",
        "departure_has_no_packages", "departure_packages_not_eligible",
    ):
        assert rule in repository
    for manifest_field in (
        "client_phone", "goods_classification", "pieces_count",
        "declared_value", "payment_status", "transport_reference",
        "MANIFEST_GENERATED",
    ):
        assert manifest_field in repository
    assert "departures.override_capacity" in api
    assert "blocking_reasons" in page
    assert "Non éligible" in page


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


def test_luza_multi_office_network_has_secure_office_scope_and_shared_destination_tracking():
    migration = read("infra/sql/124_parcel_multi_office_network.sql")
    network_repository = read("apps/api/app/organization_network/repository.py")
    network_api = read("apps/api/app/api/organization_network.py")
    tenant_repository = read("apps/api/app/tenant/repositories/tenant_repository.py")
    package_repository = read("apps/api/app/packages/repository.py")
    departure_repository = read("apps/api/app/departures/repository.py")
    dashboard_repository = read("apps/api/app/dashboard/home_repository.py")
    settings = read("apps/web/dashboard/components/settings/pilot-settings-page.tsx")
    switcher = read("apps/web/dashboard/components/tenant/organization-switcher.tsx")
    entitlements = read("apps/api/app/entitlements/repositories/entitlement_repository.py")
    features = read("apps/api/app/features/repositories/feature_repository.py")

    for capability in (
        "organization_network_memberships", "ALL_OFFICES", "ASSIGNED_OFFICES",
        "network.offices.manage", "network.members.manage", "destination_org_id",
        "organization_network_clients", "network_client_id",
    ):
        assert capability in migration
    for operation in ("def context", "def setup", "def create_office", "def grant_offices"):
        assert operation in network_repository
    for route in ('@router.get(""', '@router.post("/setup"', '@router.post("/offices"', '@router.post("/members/grant"'):
        assert route in network_api
    assert "group_id::text as group_id" in tenant_repository
    assert "p.org_id = :org_id or p.destination_org_id = :org_id" in package_repository
    assert "d.org_id=:o or d.destination_org_id=:o" in departure_repository
    assert 'scope == "network"' in dashboard_repository
    assert "ParcelNetworkSettings" in settings
    assert "grantNetworkOffices" in settings
    assert "Bureaux autorisés" in settings
    assert "role_permissions(role_id,permission_id)" in network_repository
    assert "status='SUSPENDED'" in network_repository
    assert "tenant.city" in switcher and "tenant.country" in switcher
    assert "active_org.parent_org_id" in entitlements
    assert "parent_flag.enabled" in features


def test_luza_network_offices_are_created_from_the_switcher_and_invitations_provision_selected_offices():
    migration = read("infra/sql/125_parcel_network_invitations.sql")
    network_repository = read("apps/api/app/organization_network/repository.py")
    network_api = read("apps/api/app/api/organization_network.py")
    membership_service = read("apps/api/app/organizations/services/membership_role_service.py")
    switcher = read("apps/web/dashboard/components/tenant/organization-switcher.tsx")
    settings = read("apps/web/dashboard/components/settings/pilot-settings-page.tsx")

    assert "organization_network_invitation_offices" in migration
    for operation in ("validate_invitation_offices", "attach_invitation_offices", "list_network_invitations"):
        assert f"def {operation}" in network_repository
    assert '@router.post("/invitations"' in network_api
    assert "list_invitation_office_grants" in membership_service
    assert "network_memberships" in membership_service
    assert "Ajouter un bureau" in switcher
    assert "createNetworkOffice" in switcher
    assert "Les routes et services restent dans leurs modules opérationnels" in settings
    assert "inviteNetworkMember" in settings


def test_luza_customer_identity_remains_shared_after_phone_updates():
    clients = read("apps/api/app/clients/repository.py")
    pilot_settings = read("apps/api/app/organization_admin/pilot_repository.py")

    assert clients.count("insert into organization_network_clients") >= 2
    assert "network_client_id = cast(:network_client_id as uuid)" in clients
    assert "clerk_user_id,member_display_name" in pilot_settings
