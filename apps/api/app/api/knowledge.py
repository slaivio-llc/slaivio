from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.ai.repositories.knowledge_repository import (
    create_document,
    delete_document,
    get_documents,
    search_documents,
)


router = APIRouter()


class CreateKnowledgeRequest(BaseModel):
    title: str
    content: str
    source: str = "manual"
    category: str | None = None
    tags: list[str] = []


@router.get("/knowledge")
def knowledge_list(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]
    documents = get_documents(org_id)

    return {
        "status": "ok",
        "count": len(documents),
        "documents": documents,
        "items": documents,
    }


@router.post("/knowledge")
def create_knowledge(body: CreateKnowledgeRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    document = create_document(
        org_id=org_id,
        title=body.title,
        content=body.content,
        source=body.source,
        category=body.category,
        tags=body.tags,
    )

    return {
        "status": "ok",
        "document": document,
        "item": document,
    }


@router.get("/knowledge/search")
def search_knowledge(
    q: str,
    limit: int = 5,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    documents = search_documents(
        org_id=org_id,
        query=q,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(documents),
        "documents": documents,
        "items": documents,
    }


@router.delete("/knowledge/{document_id}")
def remove_document(document_id: str):
    delete_document(document_id)

    return {
        "status": "deleted",
    }
