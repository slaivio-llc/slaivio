from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.core.auth import get_current_manager
from app.db.database import engine


router = APIRouter()


class PricingRuleRequest(BaseModel):
    origin_country: str
    destination_country: str
    rule_type: str = "PER_KG"
    price: float
    currency: str = "USD"
    goods_type: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    is_active: bool = True


@router.get("/settings/pricing-rules")
def list_pricing_rules(manager=Depends(get_current_manager)):
    org_id = manager["org_id"]

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from pricing_rules
                where org_id = :org_id
                order by created_at desc
            """),
            {"org_id": org_id},
        ).fetchall()

    return {
        "status": "ok",
        "rules": [dict(row._mapping) for row in rows],
    }


@router.post("/settings/pricing-rules")
def create_pricing_rule(
    body: PricingRuleRequest,
    manager=Depends(get_current_manager),
):
    org_id = manager["org_id"]

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into pricing_rules (
                    org_id,
                    origin_country,
                    destination_country,
                    rule_type,
                    price,
                    currency,
                    goods_type,
                    min_value,
                    max_value,
                    is_active
                )
                values (
                    :org_id,
                    :origin_country,
                    :destination_country,
                    :rule_type,
                    :price,
                    :currency,
                    :goods_type,
                    :min_value,
                    :max_value,
                    :is_active
                )
                returning *
            """),
            {
                "org_id": org_id,
                "origin_country": body.origin_country,
                "destination_country": body.destination_country,
                "rule_type": body.rule_type,
                "price": body.price,
                "currency": body.currency,
                "goods_type": body.goods_type,
                "min_value": body.min_value,
                "max_value": body.max_value,
                "is_active": body.is_active,
            },
        )

        conn.commit()
        row = result.fetchone()

    return {
        "status": "ok",
        "rule": dict(row._mapping),
    }
