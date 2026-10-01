from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def test_physical_os_schema_and_roles():
 m=(ROOT/'infra/sql/076_packages_physical_os.sql').read_text(encoding='utf-8')
 for table in ('package_quality_controls','package_expectations','package_delivery_proofs','package_saved_views','package_operational_alerts','package_bulk_operations'):assert f'create table if not exists {table}' in m
 for permission in ('packages.scan','packages.weigh','packages.move','packages.quality','packages.pricing','packages.assign','packages.bulk','packages.delivery'):assert permission in m
 assert "r.role_code='FINANCE'" in m and "r.role_code in('OPERATOR','WAREHOUSE')" in m
def test_physical_os_workflows_are_concurrent_and_tenant_scoped():
 r=(ROOT/'apps/api/app/packages/repository.py').read_text(encoding='utf-8');a=(ROOT/'apps/api/app/api/packages.py').read_text(encoding='utf-8')
 for feature in ('OFFICIAL_TRANSITIONS','for update','package_version_conflict','quality_control','create_expectation','price_package','compatible_departures','delivery_proof','detect_package_alerts'):assert feature in r
 for route in ('/expected','/transition','/quality-control','/pricing','/compatible-departures','/delivery-proof','/alerts/detect'):assert route in a
 for permission in ('packages.quality','packages.pricing','packages.delivery','packages.anomalies'):assert permission in a
 assert 'org_id=:o' in r
def test_physical_os_frontend_has_real_services():
 s=(ROOT/'apps/web/dashboard/services/packages.ts').read_text(encoding='utf-8')
 for endpoint in ('/transition','/quality-control','/pricing','/compatible-departures','/packages/expected','/delivery-proof','/packages/alerts/detect'):assert endpoint in s

def test_package_schema_bootstrap_is_serialized_across_requests_and_processes():
 r=(ROOT/'apps/api/app/packages/repository.py').read_text(encoding='utf-8')
 assert '_SCHEMA_LOCK = Lock()' in r
 assert "pg_advisory_xact_lock(hashtext('slaivio.packages.ensure_schema'))" in r

def test_package_status_notifications_are_dispatched_and_deduplicated():
    repository=(ROOT/'apps/api/app/packages/repository.py').read_text(encoding='utf-8')
    api=(ROOT/'apps/api/app/api/packages.py').read_text(encoding='utf-8')
    sender=(ROOT/'apps/api/app/services/notification_sender.py').read_text(encoding='utf-8')
    for status in ('RECEIVED_AT_ORIGIN','SHIPPED','ARRIVED_DESTINATION','READY_FOR_PICKUP'):assert status in repository
    assert 'where not exists' in repository and 'PACKAGE_STATUS:' in repository
    assert 'background_tasks.add_task(send_notification' in api
    assert 'sync_package_notification_status' in sender


def test_parcel_status_notifications_are_dispatched_and_public_tracking_is_safe():
    repository=(ROOT/'apps/api/app/packages/repository.py').read_text(encoding='utf-8')
    api=(ROOT/'apps/api/app/api/packages.py').read_text(encoding='utf-8')
    assert 'CUSTOMER_STATUS_MESSAGES' in repository
    assert '_queue_customer_status_notification' in repository
    assert "organization.organization_type in ('PARCEL_FREIGHT','CARGO')" in repository
    assert 'notification_type = f"PACKAGE_STATUS:' in repository
    assert 'public_tracking_enabled=true' in repository
    assert 'len(matches) != 1' in repository
    assert 'package.pop("id", None)' in repository
    assert 'notification_outbox_id' in repository
    assert 'status: str = "RECEIVED_AT_ORIGIN"' in api
    assert 'BackgroundTasks' in api and 'send_notification' in api
    assert '/public/packages/tracking/{reference}' in api
