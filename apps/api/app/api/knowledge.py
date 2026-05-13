from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.knowledge_repository import (
    create_knowledge_item,
    list_knowledge_items,
    get_knowledge_item,
    update_knowledge_item,
    search_knowledge_items,
)


router = APIRouter()

ORG_ID = "demo_agency"


class CreateKnowledgeItemRequest(BaseModel):
    category: str
    title: str
    content: str
    language: str = "FR"
    tags: list[str] | None = None
    priority: int = 0


class UpdateKnowledgeItemRequest(BaseModel):
    category: str | None = None
    title: str | None = None
    content: str | None = None
    language: str | None = None
    tags: list[str] | None = None
    priority: int | None = None
    is_active: bool | None = None


@router.post("/knowledge")
def create_item(body: CreateKnowledgeItemRequest):
    item = create_knowledge_item(
        org_id=ORG_ID,
        category=body.category,
        title=body.title,
        content=body.content,
        language=body.language,
        tags=body.tags,
        priority=body.priority,
    )

    return {
        "status": "ok",
        "item": item,
    }


@router.get("/knowledge")
def list_items(
    category: str | None = None,
    limit: int = 100,
):
    items = list_knowledge_items(
        org_id=ORG_ID,
        category=category,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(items),
        "items": items,
    }


@router.get("/knowledge/search")
def search_items(
    q: str,
    limit: int = 5,
):
    items = search_knowledge_items(
        org_id=ORG_ID,
        query=q,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(items),
        "items": items,
    }


@router.get("/knowledge/{item_id}")
def get_item(item_id: str):
    item = get_knowledge_item(
        org_id=ORG_ID,
        item_id=item_id,
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Knowledge item not found",
        )

    return {
        "status": "ok",
        "item": item,
    }


@router.patch("/knowledge/{item_id}")
def update_item(
    item_id: str,
    body: UpdateKnowledgeItemRequest,
):
    item = update_knowledge_item(
        org_id=ORG_ID,
        item_id=item_id,
        category=body.category,
        title=body.title,
        content=body.content,
        language=body.language,
        tags=body.tags,
        priority=body.priority,
        is_active=body.is_active,
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Knowledge item not found",
        )

    return {
        "status": "ok",
        "item": item,
    }
