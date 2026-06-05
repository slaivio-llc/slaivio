from fastapi import APIRouter
from pydantic import BaseModel

from app.performance.repositories.performance_repository import (
    list_performance_metrics,
    performance_summary,
)
from app.performance.repositories.sla_repository import list_sla_breaches
from app.performance.services.performance_service import (
    record_operator_output,
    record_response_time,
    record_shipment_delay,
)


router = APIRouter()


class ResponseTimeRequest(BaseModel):
    org_id: str
    conversation_id: str
    first_message_at: str
    first_reply_at: str
    actor_id: str | None = None
    actor_name: str | None = None


class ShipmentDelayRequest(BaseModel):
    org_id: str
    shipment_id: str
    eta_at: str
    arrived_at: str


class OperatorOutputRequest(BaseModel):
    org_id: str
    actor_id: str
    actor_name: str
    count: int
    metric_name: str = "Messages handled"


@router.post("/performance/response-time")
def create_response_time_metric(
    body: ResponseTimeRequest,
):
    return {
        "status": "ok",
        **record_response_time(
            org_id=body.org_id,
            conversation_id=body.conversation_id,
            first_message_at=body.first_message_at,
            first_reply_at=body.first_reply_at,
            actor_id=body.actor_id,
            actor_name=body.actor_name,
        ),
    }


@router.post("/performance/shipment-delay")
def create_shipment_delay_metric(
    body: ShipmentDelayRequest,
):
    return {
        "status": "ok",
        **record_shipment_delay(
            org_id=body.org_id,
            shipment_id=body.shipment_id,
            eta_at=body.eta_at,
            arrived_at=body.arrived_at,
        ),
    }


@router.post("/performance/operator-output")
def create_operator_output_metric(
    body: OperatorOutputRequest,
):
    return {
        "status": "ok",
        **record_operator_output(
            org_id=body.org_id,
            actor_id=body.actor_id,
            actor_name=body.actor_name,
            count=body.count,
            metric_name=body.metric_name,
        ),
    }


@router.get("/performance/metrics/{org_id}")
def get_metrics(
    org_id: str,
    metric_type: str | None = None,
):
    return {
        "status": "ok",
        "metrics": list_performance_metrics(
            org_id=org_id,
            metric_type=metric_type,
        ),
    }


@router.get("/performance/summary/{org_id}")
def get_summary(
    org_id: str,
):
    return {
        "status": "ok",
        "summary": performance_summary(org_id),
    }


@router.get("/performance/sla-breaches/{org_id}")
def get_breaches(
    org_id: str,
    status: str | None = None,
):
    return {
        "status": "ok",
        "breaches": list_sla_breaches(
            org_id=org_id,
            status=status,
        ),
    }

