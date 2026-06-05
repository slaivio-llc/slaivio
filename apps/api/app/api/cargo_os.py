from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.cargo_os.repository import (
    add_batch_item,
    complete_delivery_job,
    create_batch,
    create_batch_document,
    create_customs_case,
    create_delivery_job,
    create_delivery_proof,
    create_manifest,
    create_payment_check,
    create_receipt_media,
    create_route,
    create_warehouse_receipt,
    ensure_public_tracking_token,
    get_manifest_items,
    get_public_tracking,
    list_batch_events,
    list_batch_items,
    list_batches,
    list_customs_cases,
    list_delivery_jobs,
    list_inventory,
    list_manifests,
    list_receipt_media,
    list_routes,
    list_warehouse_receipts,
    register_scan,
    resolve_customs_case,
    store_inventory,
    update_batch_status,
    update_shipment_eta,
    upsert_customs_rule,
)
from app.core.auth import get_current_manager
from app.core.tenant_context import get_current_tenant
from app.shipment_lifecycle.repositories.lifecycle_repository import (
    get_shipment_lifecycle_snapshot,
    list_lifecycle_events,
)
from app.shipment_lifecycle.repositories.transition_repository import list_transitions
from app.shipment_lifecycle.services.lifecycle_service import change_shipment_status


router = APIRouter()


def actor_from_manager(manager: dict):
    return {
        "id": manager.get("user_id") or manager.get("id"),
        "name": manager.get("name") or manager.get("full_name") or manager.get("email"),
    }


class ChangeShipmentStatusRequest(BaseModel):
    status: str
    event_message: str | None = None
    metadata: dict | None = None


class ConfirmReceiptRequest(BaseModel):
    shipment_id: str
    warehouse_id: str
    supplier_name: str | None = None
    supplier_phone: str | None = None
    package_label: str | None = None
    package_condition: str = "UNKNOWN"
    measured_weight_kg: float | None = None
    measured_volume_cbm: float | None = None
    notes: str | None = None


class ReceiptMediaRequest(BaseModel):
    receipt_id: str
    shipment_id: str
    media_url: str
    media_type: str = "IMAGE"
    caption: str | None = None


class CreateBatchRequest(BaseModel):
    batch_type: str
    route_origin_country: str | None = None
    route_origin_city: str | None = None
    route_destination_country: str | None = None
    route_destination_city: str | None = None
    origin_warehouse_id: str | None = None
    destination_warehouse_id: str | None = None
    carrier_name: str | None = None
    carrier_reference: str | None = None
    eta_at: str | None = None
    notes: str | None = None


class AddBatchItemRequest(BaseModel):
    shipment_id: str


class UpdateBatchStatusRequest(BaseModel):
    status: str


class BatchDocumentRequest(BaseModel):
    batch_id: str | None = None
    manifest_id: str | None = None
    document_type: str
    document_url: str | None = None
    document_status: str = "GENERATED"
    metadata: dict | None = None


class CreateCustomsCaseRequest(BaseModel):
    shipment_id: str | None = None
    batch_id: str | None = None
    customs_status: str = "OPEN"
    risk_level: str = "UNKNOWN"
    country_code: str | None = None
    declared_value: float | None = None
    declared_currency: str | None = None
    goods_description: str | None = None
    blocked_reason: str | None = None
    compliance_hold: bool = True
    raw_payload: dict | None = None


class CustomsRuleRequest(BaseModel):
    country_code: str | None = None
    goods_type: str
    risk_level: str = "LOW"
    requires_document: bool = False
    forbidden: bool = False
    rule_message: str | None = None
    active: bool = True


class CreateRouteRequest(BaseModel):
    route_code: str | None = None
    route_name: str
    origin_country: str | None = None
    origin_city: str | None = None
    destination_country: str | None = None
    destination_city: str | None = None
    transport_mode: str = "AIR"
    expected_duration_days: int | None = None
    active: bool = True


class UpdateEtaRequest(BaseModel):
    route_id: str | None = None
    eta_at: str
    delay_status: str = "ON_TIME"
    delay_reason: str | None = None
    event_source: str = "MANAGER"


class ScanRequest(BaseModel):
    shipment_ref: str
    scan_type: str
    barcode: str | None = None
    warehouse_id: str | None = None
    location_label: str | None = None
    metadata: dict | None = None


class StoreInventoryRequest(BaseModel):
    shipment_id: str
    warehouse_id: str
    storage_location_id: str
    notes: str | None = None


class CreateDeliveryJobRequest(BaseModel):
    shipment_id: str
    job_type: str = "PICKUP"
    recipient_name: str | None = None
    recipient_phone: str | None = None
    pickup_location: str | None = None
    delivery_address: str | None = None
    scheduled_at: str | None = None
    assigned_manager_id: str | None = None
    assigned_manager_name: str | None = None
    notes: str | None = None


class DeliveryProofRequest(BaseModel):
    delivery_job_id: str
    shipment_id: str
    proof_type: str
    proof_url: str | None = None
    proof_text: str | None = None
    verified: bool = False
    verification_status: str = "PENDING"
    metadata: dict | None = None


class PaymentCheckRequest(BaseModel):
    shipment_id: str
    delivery_job_id: str | None = None
    required_amount: float | None = None
    paid_amount: float | None = None
    currency: str | None = None
    payment_status: str = "UNKNOWN"
    release_allowed: bool = False
    raw_payload: dict | None = None


class CompleteDeliveryRequest(BaseModel):
    recipient_name: str | None = None
    recipient_phone: str | None = None


@router.get("/shipments/{shipment_id}/timeline")
def shipment_timeline(
    shipment_id: str,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "shipment": get_shipment_lifecycle_snapshot(
            org_id=tenant["org_id"],
            shipment_id=shipment_id,
        ),
        "events": list_lifecycle_events(
            org_id=tenant["org_id"],
            shipment_id=shipment_id,
        ),
    }


@router.get("/shipments/lifecycle/transitions")
def shipment_lifecycle_transitions():
    return {
        "status": "ok",
        "transitions": list_transitions(),
    }


@router.patch("/shipments/{shipment_id}/lifecycle")
def update_shipment_lifecycle(
    shipment_id: str,
    body: ChangeShipmentStatusRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    actor = actor_from_manager(manager)
    result = change_shipment_status(
        org_id=tenant["org_id"],
        shipment_id=shipment_id,
        next_status=body.status,
        event_message=body.event_message or "Shipment status changed",
        metadata=body.metadata or {},
        actor_id=actor["id"],
        actor_name=actor["name"],
    )
    return {"status": "ok", **result}


@router.post("/warehouse/receipts")
def confirm_receipt(
    body: ConfirmReceiptRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    result = create_warehouse_receipt(
        org_id=tenant["org_id"],
        payload=body.model_dump(),
        actor=actor_from_manager(manager),
    )
    return {"status": "ok", **result}


@router.get("/warehouse/receipts")
def warehouse_receipts(
    warehouse_id: str | None = None,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "receipts": list_warehouse_receipts(tenant["org_id"], warehouse_id),
    }


@router.post("/warehouse/receipt-media")
def add_receipt_media(
    body: ReceiptMediaRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "media": create_receipt_media(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.get("/warehouse/receipts/{receipt_id}/media")
def receipt_media(
    receipt_id: str,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "media": list_receipt_media(tenant["org_id"], receipt_id),
    }


@router.post("/shipment-batches")
def create_shipment_batch(
    body: CreateBatchRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "batch": create_batch(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.get("/shipment-batches")
def shipment_batches(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "batches": list_batches(tenant["org_id"]),
    }


@router.post("/shipment-batches/{batch_id}/items")
def shipment_batch_add_item(
    batch_id: str,
    body: AddBatchItemRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "item": add_batch_item(
            tenant["org_id"],
            batch_id,
            body.shipment_id,
            actor_from_manager(manager),
        ),
    }


@router.get("/shipment-batches/{batch_id}/items")
def shipment_batch_items(
    batch_id: str,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "items": list_batch_items(tenant["org_id"], batch_id),
    }


@router.patch("/shipment-batches/{batch_id}/status")
def shipment_batch_status(
    batch_id: str,
    body: UpdateBatchStatusRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "batch": update_batch_status(
            tenant["org_id"],
            batch_id,
            body.status,
            actor_from_manager(manager),
        ),
    }


@router.get("/shipment-batches/{batch_id}/events")
def shipment_batch_events(
    batch_id: str,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "events": list_batch_events(tenant["org_id"], batch_id),
    }


@router.post("/manifests/batches/{batch_id}")
def create_batch_manifest(
    batch_id: str,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    manifest = create_manifest(
        tenant["org_id"],
        batch_id,
        actor_from_manager(manager),
    )
    if not manifest:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"status": "ok", "manifest": manifest}


@router.get("/manifests")
def manifests(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "manifests": list_manifests(tenant["org_id"]),
    }


@router.get("/manifests/{manifest_id}/items")
def manifest_items(
    manifest_id: str,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "items": get_manifest_items(tenant["org_id"], manifest_id),
    }


@router.post("/batch-documents")
def batch_document(
    body: BatchDocumentRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "document": create_batch_document(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.post("/customs/cases")
def customs_case(
    body: CreateCustomsCaseRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "case": create_customs_case(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.get("/customs/cases")
def customs_cases(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "cases": list_customs_cases(tenant["org_id"]),
    }


@router.patch("/customs/cases/{case_id}/resolve")
def customs_resolve(
    case_id: str,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "case": resolve_customs_case(
            tenant["org_id"],
            case_id,
            actor_from_manager(manager),
        ),
    }


@router.post("/customs/rules")
def customs_rule(
    body: CustomsRuleRequest,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "rule": upsert_customs_rule(
            tenant["org_id"],
            body.model_dump(),
        ),
    }


@router.post("/routes-engine/routes")
def route_create(
    body: CreateRouteRequest,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "route": create_route(tenant["org_id"], body.model_dump()),
    }


@router.get("/routes-engine/routes")
def routes_list(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "routes": list_routes(tenant["org_id"]),
    }


@router.patch("/routes-engine/shipments/{shipment_id}/eta")
def eta_update(
    shipment_id: str,
    body: UpdateEtaRequest,
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "shipment": update_shipment_eta(
            tenant["org_id"],
            shipment_id,
            body.model_dump(),
        ),
    }


@router.post("/shipments/{shipment_id}/public-token")
def public_token(
    shipment_id: str,
    tenant=Depends(get_current_tenant),
):
    token = ensure_public_tracking_token(tenant["org_id"], shipment_id)
    return {
        "status": "ok",
        "tracking_token": token,
        "tracking_path": f"/track/{token}",
    }


@router.get("/track/{tracking_token}")
def public_tracking(
    tracking_token: str,
    request: Request,
):
    shipment = get_public_tracking(
        tracking_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Tracking not found")
    return {
        "status": "ok",
        "shipment": shipment,
    }


@router.post("/warehouse/scans")
def warehouse_scan(
    body: ScanRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    scan = register_scan(
        tenant["org_id"],
        body.model_dump(),
        actor_from_manager(manager),
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return {"status": "ok", "scan": scan}


@router.post("/warehouse/inventory/store")
def inventory_store(
    body: StoreInventoryRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "inventory": store_inventory(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.get("/warehouse/inventory")
def inventory_list(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "inventory": list_inventory(tenant["org_id"]),
    }


@router.post("/delivery/jobs")
def delivery_job(
    body: CreateDeliveryJobRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "job": create_delivery_job(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.get("/delivery/jobs")
def delivery_jobs(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "jobs": list_delivery_jobs(tenant["org_id"]),
    }


@router.post("/delivery/proofs")
def delivery_proof(
    body: DeliveryProofRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "proof": create_delivery_proof(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.post("/delivery/payment-checks")
def delivery_payment_check(
    body: PaymentCheckRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "payment_check": create_payment_check(
            tenant["org_id"],
            body.model_dump(),
            actor_from_manager(manager),
        ),
    }


@router.patch("/delivery/jobs/{job_id}/complete")
def delivery_complete(
    job_id: str,
    body: CompleteDeliveryRequest,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    result = complete_delivery_job(
        tenant["org_id"],
        job_id,
        body.model_dump(),
        actor_from_manager(manager),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Delivery job not found")
    if isinstance(result, dict) and result.get("blocked"):
        raise HTTPException(status_code=409, detail=result)
    return {
        "status": "ok",
        "job": result,
    }

