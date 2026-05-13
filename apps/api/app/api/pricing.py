from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.pricing_repository import (
    create_pricing_rule,
    list_pricing_rules,
    get_pricing_rule,
    update_pricing_rule,
)

from app.services.pricing_engine import calculate_price


router = APIRouter()

ORG_ID = "demo_agency"


class PricingRequest(BaseModel):
    origin_country: str
    destination_country: str
    origin_city: str | None = None
    destination_city: str | None = None
    shipping_mode: str | None = None
    weight_kg: float | None = None
    volume_cbm: float | None = None
    goods_type: str | None = None
    declared_value: float | None = None


class CreatePricingRuleRequest(BaseModel):
    origin_country: str | None = None
    origin_city: str | None = None
    destination_country: str | None = None
    destination_city: str | None = None
    shipping_mode: str | None = None
    goods_type: str | None = None
    rule_type: str = "PER_KG"
    pricing_mode: str | None = None
    unit: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    price: float
    currency: str = "USD"
    note: str | None = None
    requires_manual_confirmation: bool = False
    priority: int = 0


class UpdatePricingRuleRequest(BaseModel):
    origin_country: str | None = None
    origin_city: str | None = None
    destination_country: str | None = None
    destination_city: str | None = None
    shipping_mode: str | None = None
    goods_type: str | None = None
    rule_type: str | None = None
    pricing_mode: str | None = None
    unit: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    price: float | None = None
    currency: str | None = None
    note: str | None = None
    requires_manual_confirmation: bool | None = None
    priority: int | None = None
    is_active: bool | None = None


@router.post("/pricing/calculate")
def pricing(body: PricingRequest):
    result = calculate_price(
        org_id=ORG_ID,
        origin_country=body.origin_country,
        destination_country=body.destination_country,
        origin_city=body.origin_city,
        destination_city=body.destination_city,
        shipping_mode=body.shipping_mode,
        weight_kg=body.weight_kg,
        volume_cbm=body.volume_cbm,
        goods_type=body.goods_type,
        declared_value=body.declared_value,
    )

    return {
        "status": "ok",
        "result": result,
    }


@router.post("/pricing/rules")
def create_rule(body: CreatePricingRuleRequest):
    rule = create_pricing_rule(
        org_id=ORG_ID,
        origin_country=body.origin_country,
        origin_city=body.origin_city,
        destination_country=body.destination_country,
        destination_city=body.destination_city,
        shipping_mode=body.shipping_mode,
        goods_type=body.goods_type,
        rule_type=body.rule_type,
        pricing_mode=body.pricing_mode,
        unit=body.unit,
        min_value=body.min_value,
        max_value=body.max_value,
        price=body.price,
        currency=body.currency,
        note=body.note,
        requires_manual_confirmation=body.requires_manual_confirmation,
        priority=body.priority,
    )

    return {
        "status": "ok",
        "rule": rule,
    }


@router.get("/pricing/rules")
def list_rules(limit: int = 100):
    rules = list_pricing_rules(
        org_id=ORG_ID,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(rules),
        "rules": rules,
    }


@router.get("/pricing/rules/{rule_id}")
def get_rule(rule_id: str):
    rule = get_pricing_rule(
        org_id=ORG_ID,
        rule_id=rule_id,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Pricing rule not found",
        )

    return {
        "status": "ok",
        "rule": rule,
    }


@router.patch("/pricing/rules/{rule_id}")
def update_rule(
    rule_id: str,
    body: UpdatePricingRuleRequest,
):
    rule = update_pricing_rule(
        org_id=ORG_ID,
        rule_id=rule_id,
        **body.model_dump(exclude_none=True),
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Pricing rule not found",
        )

    return {
        "status": "ok",
        "rule": rule,
    }
