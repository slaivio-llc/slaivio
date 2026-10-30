from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from pydantic import ValidationError

from app.api.tracking import EventPayload, router
from app.organizations.services.provisioning_service import TRACKING_ROLE_PERMISSIONS


EXPECTED={
 ("/tracking","GET"):"tracking.read",("/tracking/stats","GET"):"tracking.read",("/tracking/timeline","GET"):"tracking.read",
 ("/tracking/analytics","GET"):"tracking.read",("/tracking/alerts","GET"):"tracking.read",("/tracking/alerts/detect","POST"):"tracking.alerts",
 ("/tracking/views","GET"):"tracking.read",("/tracking/views","POST"):"tracking.update",("/tracking/export","GET"):"tracking.export",
 ("/tracking/notifications/bulk","POST"):"tracking.notify",("/tracking/{tracking_id}","GET"):"tracking.read",
 ("/tracking/{tracking_id}/events","POST"):"tracking.update",("/tracking/{tracking_id}/eta","PATCH"):"tracking.update",
 ("/tracking/{tracking_id}/assignment","PATCH"):"tracking.update",("/tracking/{tracking_id}/alerts","POST"):"tracking.alerts",
 ("/tracking/{tracking_id}/alerts/{alert_id}/resolve","PATCH"):"tracking.alerts",("/tracking/{tracking_id}/alerts/{alert_id}","PATCH"):"tracking.alerts",
 ("/tracking/{tracking_id}/notes","POST"):"tracking.update",("/tracking/{tracking_id}/documents","POST"):"tracking.update",
 ("/tracking/{tracking_id}/documents/upload","POST"):"tracking.update",("/tracking/{tracking_id}/documents/{document_id}/view","GET"):"tracking.read",
 ("/tracking/{tracking_id}/notifications","POST"):"tracking.notify",("/tracking/{tracking_id}/public-token","POST"):"tracking.public",
 ("/tracking/{tracking_id}/public-token","DELETE"):"tracking.public",("/tracking/{tracking_id}","DELETE"):"tracking.update",
}

def permission(call):
    for cell in call.__closure__ or ():
        value=cell.cell_contents
        if isinstance(value,str) and value.startswith("tracking."):return value
    return None

def test_every_private_tracking_route_has_exact_permission():
    actual={}
    for route in router.routes:
        if not isinstance(route,APIRoute) or route.path.startswith("/public/"):continue
        for method in route.methods or set():
            permissions={value for dependency in route.dependant.dependencies if (value:=permission(dependency.call))}
            assert len(permissions)==1,(route.path,method,permissions)
            actual[(route.path,method)]=permissions.pop()
    assert actual==EXPECTED

def test_tracking_default_roles_are_least_privilege():
    assert set(TRACKING_ROLE_PERMISSIONS["OWNER"])=={"tracking.read","tracking.update","tracking.alerts","tracking.notify","tracking.export","tracking.public"}
    assert TRACKING_ROLE_PERMISSIONS["MANAGER"]==TRACKING_ROLE_PERMISSIONS["OWNER"]
    assert "tracking.public" not in TRACKING_ROLE_PERMISSIONS["OPERATOR"]
    assert "tracking.update" not in TRACKING_ROLE_PERMISSIONS["SUPPORT"]
    assert not TRACKING_ROLE_PERMISSIONS.get('FINANCE')

def test_tracking_migration_contains_tenant_and_concurrency_guards():
    sql=(Path(__file__).parents[3]/"infra/sql/042_tracking_control_tower.sql").read_text(encoding="utf-8").lower()
    assert "org_id" in sql
    assert "idempotency_key" in sql
    assert "tracking_alert_history" in sql
    assert "tracking_audit_log" in sql
    assert "revoke all" in sql

def test_tracking_never_substitutes_record_update_for_a_real_signal():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    assert "coalesce(e.last_signal_at,e.updated_at)" not in source
    assert "e.last_signal_at,e.last_signal_source" in source
    assert "status not in ('DELIVERED','CANCELLED','ARCHIVED')" in source
    assert "coalesce(last_signal_at,departed_at,updated_at)" in source

def test_tracking_does_not_present_unmaintained_progress_percent_as_real():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    assert source.count("null::integer progress_percent") == 2

def test_public_shipment_timeline_only_exposes_safe_milestones():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    public_view=source.split("def public_view(",1)[1].split("def save_view(",1)[0]
    for event in ("EXPEDITION_CREATED","SHIPMENT_DEPARTED","DEPARTURE_DEPARTED",
                  "SHIPMENT_ARRIVED","DEPARTURE_ARRIVED"):
        assert event in public_view
    assert "null::text description" in public_view
    assert "select event_type,title,description,occurred_at" not in public_view
    assert "FINANCE_LINE_ADDED" not in public_view
    assert "NOTE_ADDED" not in public_view

def test_packages_in_transit_metric_counts_parcels_not_expeditions():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def tracking_stats(",1)[1].split("def global_timeline(",1)[0]
    assert "from cargo_packages p where p.org_id=:org_id" in stats
    assert "p.status in ('SHIPPED','IN_TRANSIT')" in stats
    assert "count(*) filter(where status='IN_TRANSIT')::int packages_in_transit" not in stats

def test_eta_compliance_uses_only_deliveries_with_a_known_eta():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    analytics=source.split("def tracking_analytics(",1)[1].split("def list_alerts(",1)[0]
    assert "delivered_with_eta" in analytics
    assert "delivered_at is not null and eta_at is not null and delivered_at<=eta_at" in analytics
    assert "arrived_with_eta" in analytics
    assert "arrived_at is not null and eta_at is not null and arrived_at<=eta_at" in analytics

def test_route_eta_performance_uses_actual_destination_arrivals():
    source=(Path(__file__).parents[1]/"app"/"routes_services"/"repository.py").read_text(encoding="utf-8")
    assert "e.arrived_at<=e.eta_at" in source
    assert "e.arrived_at is not null and e.eta_at is not null" in source
    assert "delivered_at<=e.eta_at" not in source

def test_route_performance_excludes_archived_shipments():
    source=(Path(__file__).parents[1]/"app"/"routes_services"/"repository.py").read_text(encoding="utf-8")
    assert source.count("archived_at is null") >= 3
    assert "e.deleted_at is null and e.archived_at is null" in source

def test_eta_overdue_is_cleared_by_actual_arrival_across_tracking_views():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    analytics=source.split("def tracking_analytics(",1)[1].split("def list_alerts(",1)[0]
    stats=source.split("def tracking_stats(",1)[1].split("def global_timeline(",1)[0]
    alert_rules=source.split("def detect_simple_alerts(",1)[1].split("def detect_all_tracking_alerts(",1)[0]
    assert 'TRACKING_DELAY_PREDICATE="status not in (\'DELIVERED\',\'CANCELLED\',\'ARCHIVED\') and arrived_at is null' in source
    assert "{TRACKING_DELAY_PREDICATE}" in analytics
    assert "{TRACKING_DELAY_PREDICATE}" in stats
    assert '"eta_at<now() and arrived_at is null' in alert_rules
    assert "deleted_at is null and archived_at is null" in analytics

def test_tracking_transit_duration_does_not_substitute_planned_departure():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def tracking_stats(",1)[1].split("def global_timeline(",1)[0]
    assert "arrived_at-departed_at" in stats
    assert "arrived_at is not null and departed_at is not null" in stats
    assert "delivered_at-departed_at" not in stats
    assert "coalesce(departed_at,planned_departure_at)" not in stats

def test_operations_tracking_phases_use_real_expedition_status_and_signal_data(monkeypatch):
    from unittest.mock import MagicMock
    from app.tracking import repository
    engine=MagicMock()
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.scalar.return_value=0
    conn.execute.return_value.fetchall.return_value=[]
    monkeypatch.setattr(repository,'engine',engine)
    for phase, expected in (("transit","e.status in ('DISPATCHED','IN_TRANSIT')"),
                            ("delayed","eta_at<now()"),
                            ("arrived","e.arrived_at is not null")):
        repository.control_tower('org-a',phase=phase)
        count_sql=str(conn.execute.call_args_list[-2].args[0])
        rows_sql=str(conn.execute.call_args_list[-1].args[0])
        assert expected in count_sql
        assert 'is_overdue' in rows_sql
        assert '{delayed_expression}' not in rows_sql

def test_manual_tracking_event_rejects_future_or_timezone_free_timestamps():
    with pytest.raises(ValidationError, match="occurred_at_cannot_be_in_future"):
        EventPayload(event_type="ARRIVAL", title="Arrivée", occurred_at="2999-01-01T12:00:00Z")
    with pytest.raises(ValidationError, match="occurred_at_must_include_timezone"):
        EventPayload(event_type="ARRIVAL", title="Arrivée", occurred_at="2026-10-17T12:00:00")


def test_manual_tracking_event_accepts_historical_timestamp_with_timezone():
    event = EventPayload(event_type="ARRIVAL", title="Arrivée", occurred_at="2026-10-17T12:00:00Z")

    assert event.occurred_at == "2026-10-17T12:00:00+00:00"

def test_tracking_timeline_does_not_backfill_old_event_location_from_current_location():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    timeline=source.split("def global_timeline(",1)[1].split("def tracking_detail(",1)[0]
    assert "ev.metadata->>'location' location" in timeline
    assert "coalesce(ev.metadata->>'location',e.last_location)" not in timeline

def test_expedition_arrival_kpi_does_not_count_stale_eta_after_arrival():
    source=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def expedition_stats(",1)[1].split("def expedition_analytics(",1)[0]
    assert "arrived_at::date = current_date" in stats
    assert "arrived_at is null and eta_at::date = current_date" in stats
    assert "'ARRIVED_DESTINATION','CUSTOMS_CLEARANCE','AVAILABLE_FOR_PICKUP'" in stats
    assert "deleted_at is null" in stats

def test_expedition_delivery_rate_excludes_drafts_and_cancelled_rows():
    source=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def expedition_stats(",1)[1].split("def expedition_analytics(",1)[0]
    assert "count(*) filter (where status = 'DELIVERED')" in stats
    assert "count(*) filter (where status not in ('DRAFT','CANCELLED','ARCHIVED'))" in stats
    assert "archived_at is null and deleted_at is null" in stats

def test_expedition_in_transit_kpi_requires_confirmed_departure():
    source=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def expedition_stats(",1)[1].split("def expedition_analytics(",1)[0]
    assert "status in ('DISPATCHED','IN_TRANSIT') and departed_at is not null" in stats
    assert "count(*) filter (where status = 'IN_TRANSIT')::int in_transit" not in stats

def test_active_expedition_kpi_excludes_drafts():
    source=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def expedition_stats(",1)[1].split("def expedition_analytics(",1)[0]
    assert "status not in ('DRAFT','DELIVERED','CANCELLED','ARCHIVED')" in stats

def test_expedition_analytics_excludes_soft_deleted_rows_from_every_report():
    source=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    analytics=source.split("def expedition_analytics(",1)[1].split("def get_expedition(",1)[0]
    assert analytics.count("deleted_at is null") >= 6
    assert analytics.count("archived_at is null") >= 6

def test_tracking_analytics_applies_active_expedition_scope_to_all_series():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    analytics=source.split("def tracking_analytics(",1)[1].split("def list_alerts(",1)[0]
    assert "ae.deleted_at is null and ae.archived_at is null" in analytics
    assert '"best_routes":grouped' in analytics
    assert '"incidents_by_type":grouped' in analytics
    assert '"deliveries":grouped' in analytics
    assert analytics.count("deleted_at is null") >= 7
    assert analytics.count("archived_at is null") >= 7

def test_expedition_delay_metrics_ignore_eta_after_arrival_and_include_overdue_eta():
    source=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    stats=source.split("def expedition_stats(",1)[1].split("def expedition_analytics(",1)[0]
    analytics=source.split("def expedition_analytics(",1)[1].split("def get_expedition(",1)[0]
    assert 'EXPEDITION_DELAY_PREDICATE="status=\'BLOCKED\' or (' in source
    assert "arrived_at is null" in source.split("EXPEDITION_DELAY_PREDICATE=",1)[1].split("\n",1)[0]
    assert "{EXPEDITION_DELAY_PREDICATE}" in stats
    assert "{EXPEDITION_DELAY_PREDICATE}" in analytics

def test_archiving_tracking_revokes_and_hides_public_access():
    source=(Path(__file__).parents[1]/"app"/"tracking"/"repository.py").read_text(encoding="utf-8")
    archive=source.split("def archive_tracking(",1)[1].split("def public_token(",1)[0]
    public_view=source.split("def public_view(",1)[1].split("def save_view(",1)[0]
    assert "public_tracking_enabled=false" in archive
    assert "public_tracking_token=null" in archive
    assert "archived_at is null" in public_view
    token_creation=source.split("def public_token(",1)[1].split("def public_view(",1)[0]
    assert "deleted_at is null and archived_at is null" in token_creation
    expeditions=(Path(__file__).parents[1]/"app"/"expeditions"/"repository.py").read_text(encoding="utf-8")
    legacy_archive=expeditions.split("def archive_expedition(",1)[1].split("PACKAGE_ELIGIBILITY_LABELS",1)[0]
    assert "public_tracking_enabled=false" in legacy_archive
    assert "public_tracking_token=null" in legacy_archive
