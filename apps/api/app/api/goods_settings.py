from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.core.auth import get_current_manager
from app.db.database import engine


router = APIRouter()


class GoodsRuleRequest(BaseModel):
    goods_name: str
    category: str = "GENERAL"
    is_accepted: bool = True
    pricing_mode: str | None = None
    note: str | None = None
    requires_manager_review: bool = False


@router.get("/settings/goods-rules")
def list_goods_rules(manager=Depends(get_current_manager)):
    org_id = manager["org_id"]

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from goods_rules
                where org_id = :org_id
                order by created_at desc
            """),
            {"org_id": org_id},
        ).fetchall()

    return {
        "status": "ok",
        "rules": [dict(row._mapping) for row in rows],
    }


@router.post("/settings/goods-rules")
def create_goods_rule(
    body: GoodsRuleRequest,
    manager=Depends(get_current_manager),
):
    org_id = manager["org_id"]

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into goods_rules (
                    org_id,
                    goods_name,
                    category,
                    is_accepted,
                    pricing_mode,
                    note,
                    requires_manager_review
                )
                values (
                    :org_id,
                    :goods_name,
                    :category,
                    :is_accepted,
                    :pricing_mode,
                    :note,
                    :requires_manager_review
                )
                returning *
            """),
            {
                "org_id": org_id,
                "goods_name": body.goods_name,
                "category": body.category,
                "is_accepted": body.is_accepted,
                "pricing_mode": body.pricing_mode,
                "note": body.note,
                "requires_manager_review": body.requires_manager_review,
            },
        )

        conn.commit()
        row = result.fetchone()

    return {
        "status": "ok",
        "rule": dict(row._mapping),
    }


0.D — SQL Goods Rules
create table if not exists goods_rules (
    id uuid primary key default gen_random_uuid(),

    org_id text references organizations(id),

    goods_name text not null,
    category text default 'GENERAL',

    is_accepted boolean default true,

    pricing_mode text,
    note text,

    requires_manager_review boolean default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
