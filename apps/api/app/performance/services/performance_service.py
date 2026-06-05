from datetime import datetime

from app.performance.repositories.performance_repository import create_performance_metric
from app.performance.services.sla_evaluator_service import evaluate_metric_against_sla


def _parse_datetime(value: str):
    return datetime.fromisoformat(
        value.replace("Z", "+00:00"),
    )


def record_response_time(
    org_id: str,
    conversation_id: str,
    first_message_at: str,
    first_reply_at: str,
    actor_id: str | None = None,
    actor_name: str | None = None,
):
    start = _parse_datetime(first_message_at)
    end = _parse_datetime(first_reply_at)
    diff_minutes = (end - start).total_seconds() / 60

    metric = create_performance_metric(
        org_id=org_id,
        metric_type="RESPONSE_TIME",
        metric_name="First response time",
        metric_value=max(diff_minutes, 0),
        metric_unit="minutes",
        entity_type="conversation",
        entity_id=conversation_id,
        actor_id=actor_id,
        actor_name=actor_name,
        metadata={
            "first_message_at": first_message_at,
            "first_reply_at": first_reply_at,
        },
    )

    breaches = evaluate_metric_against_sla(
        org_id=org_id,
        metric=metric,
    )

    return {
        "metric": metric,
        "breaches": breaches,
    }


def record_shipment_delay(
    org_id: str,
    shipment_id: str,
    eta_at: str,
    arrived_at: str,
):
    eta = _parse_datetime(eta_at)
    arrived = _parse_datetime(arrived_at)
    delay_days = (arrived - eta).total_seconds() / 86400

    metric = create_performance_metric(
        org_id=org_id,
        metric_type="SHIPMENT_DELAY",
        metric_name="Shipment delay",
        metric_value=max(delay_days, 0),
        metric_unit="days",
        entity_type="shipment",
        entity_id=shipment_id,
        metadata={
            "eta_at": eta_at,
            "arrived_at": arrived_at,
        },
    )

    breaches = evaluate_metric_against_sla(
        org_id=org_id,
        metric=metric,
    )

    return {
        "metric": metric,
        "breaches": breaches,
    }


def record_operator_output(
    org_id: str,
    actor_id: str,
    actor_name: str,
    count: int,
    metric_name: str = "Messages handled",
):
    metric = create_performance_metric(
        org_id=org_id,
        metric_type="OPERATOR_OUTPUT",
        metric_name=metric_name,
        metric_value=count,
        metric_unit="count",
        actor_id=actor_id,
        actor_name=actor_name,
    )

    return {
        "metric": metric,
        "breaches": [],
    }

