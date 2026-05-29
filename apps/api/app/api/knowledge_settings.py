from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.core.auth import get_current_manager
from app.db.database import engine


router = APIRouter()


class KnowledgeItemRequest(BaseModel):
    title: str
    content: str
    category: str = "GENERAL"
    is_active: bool = True


@router.get("/settings/knowledge")
def list_knowledge(manager=Depends(get_current_manager)):
    org_id = manager["org_id"]

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from agency_knowledge_items
                where org_id = :org_id
                order by created_at desc
            """),
            {"org_id": org_id},
        ).fetchall()

    return {
        "status": "ok",
        "items": [dict(row._mapping) for row in rows],
    }


@router.post("/settings/knowledge")
def create_knowledge(
    body: KnowledgeItemRequest,
    manager=Depends(get_current_manager),
):
    org_id = manager["org_id"]

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into agency_knowledge_items (
                    org_id,
                    title,
                    content,
                    category,
                    is_active
                )
                values (
                    :org_id,
                    :title,
                    :content,
                    :category,
                    :is_active
                )
                returning *
            """),
            {
                "org_id": org_id,
                "title": body.title,
                "content": body.content,
                "category": body.category,
                "is_active": body.is_active,
            },
        )

        conn.commit()
        row = result.fetchone()

    return {
        "status": "ok",
        "item": dict(row._mapping),
    }
