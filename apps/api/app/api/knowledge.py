from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.repositories.knowledge_repository import (
    create_document,
    delete_document,
    get_documents,
    search_documents,
)


router = APIRouter()
ORG_ID = "demo_agency"


class CreateKnowledgeRequest(BaseModel):
    title: str
    content: str
    source: str = "manual"
    category: str | None = None
    tags: list[str] = []


@router.get("/knowledge")
def knowledge_list():
    documents = get_documents(ORG_ID)

    return {
        "status": "ok",
        "count": len(documents),
        "documents": documents,
        "items": documents,
    }


@router.post("/knowledge")
def create_knowledge(body: CreateKnowledgeRequest):
    document = create_document(
        org_id=ORG_ID,
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
):
    documents = search_documents(
        org_id=ORG_ID,
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
