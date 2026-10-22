from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel,Field,ConfigDict

from app.core.tenant_context import get_current_tenant
from app.core.permissions import require_permission
from app.db.goods_repository import (
    create_goods_rule,
    list_goods_rules,
    get_goods_rule,
    update_goods_rule,
    search_goods_rules,
)


router = APIRouter()


class CreateGoodsRuleRequest(BaseModel):
    model_config=ConfigDict(str_strip_whitespace=True)
    goods_name: str=Field(min_length=2,max_length=160)
    category: str | None=Field(default=None,max_length=120)
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
    model_config=ConfigDict(str_strip_whitespace=True)
    goods_name: str | None=Field(default=None,min_length=2,max_length=160)
    category: str | None=Field(default=None,max_length=120)
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


@router.post("/goods/rules",dependencies=[Depends(require_permission('settings.write'))])
def create_rule(body: CreateGoodsRuleRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    rule = create_goods_rule(
        org_id=org_id,
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


@router.get("/goods/rules",dependencies=[Depends(require_permission('organization.read'))])
def list_rules(
    category: str | None = None,
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    rules = list_goods_rules(
        org_id=org_id,
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
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    rules = search_goods_rules(
        org_id=org_id,
        query=q,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(rules),
        "rules": rules,
    }


@router.get("/goods/rules/{rule_id}")
def get_rule(rule_id: str, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    rule = get_goods_rule(
        org_id=org_id,
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


@router.patch("/goods/rules/{rule_id}",dependencies=[Depends(require_permission('settings.write'))])
def update_rule(
    rule_id: str,
    body: UpdateGoodsRuleRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    rule = update_goods_rule(
        org_id=org_id,
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
