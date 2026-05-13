from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.goods_repository import (
    create_goods_rule,
    list_goods_rules,
    get_goods_rule,
    update_goods_rule,
    search_goods_rules,
)


router = APIRouter()

ORG_ID = "demo_agency"


class CreateGoodsRuleRequest(BaseModel):
    goods_name: str
    category: str | None = None
    accepted: bool = True
    pricing_mode: str = "PER_KG"
    price_note: str | None = None
    handling_note: str | None = None
    restriction_note: str | None = None
    requires_manual_validation: bool = False
    language: str = "FR"
    tags: list[str] | None = None
    priority: int = 0


class UpdateGoodsRuleRequest(BaseModel):
    goods_name: str | None = None
    category: str | None = None
    accepted: bool | None = None
    pricing_mode: str | None = None
    price_note: str | None = None
    handling_note: str | None = None
    restriction_note: str | None = None
    requires_manual_validation: bool | None = None
    language: str | None = None
    tags: list[str] | None = None
    priority: int | None = None
    is_active: bool | None = None


@router.post("/goods/rules")
def create_rule(body: CreateGoodsRuleRequest):
    rule = create_goods_rule(
        org_id=ORG_ID,
        goods_name=body.goods_name,
        category=body.category,
        accepted=body.accepted,
        pricing_mode=body.pricing_mode,
        price_note=body.price_note,
        handling_note=body.handling_note,
        restriction_note=body.restriction_note,
        requires_manual_validation=body.requires_manual_validation,
        language=body.language,
        tags=body.tags,
        priority=body.priority,
    )

    return {
        "status": "ok",
        "rule": rule,
    }


@router.get("/goods/rules")
def list_rules(
    category: str | None = None,
    limit: int = 100,
):
    rules = list_goods_rules(
        org_id=ORG_ID,
        category=category,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(rules),
        "rules": rules,
    }


@router.get("/goods/rules/search")
def search_rules(
    q: str,
    limit: int = 5,
):
    rules = search_goods_rules(
        org_id=ORG_ID,
        query=q,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(rules),
        "rules": rules,
    }


@router.get("/goods/rules/{rule_id}")
def get_rule(rule_id: str):
    rule = get_goods_rule(
        org_id=ORG_ID,
        rule_id=rule_id,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Goods rule not found",
        )

    return {
        "status": "ok",
        "rule": rule,
    }


@router.patch("/goods/rules/{rule_id}")
def update_rule(
    rule_id: str,
    body: UpdateGoodsRuleRequest,
):
    rule = update_goods_rule(
        org_id=ORG_ID,
        rule_id=rule_id,
        goods_name=body.goods_name,
        category=body.category,
        accepted=body.accepted,
        pricing_mode=body.pricing_mode,
        price_note=body.price_note,
        handling_note=body.handling_note,
        restriction_note=body.restriction_note,
        requires_manual_validation=body.requires_manual_validation,
        language=body.language,
        tags=body.tags,
        priority=body.priority,
        is_active=body.is_active,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Goods rule not found",
        )

    return {
        "status": "ok",
        "rule": rule,
    }
