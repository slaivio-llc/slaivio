from app.ai.repositories.knowledge_repository import (
    get_documents,
    search_documents,
)


def retrieve_relevant_knowledge(
    org_id: str,
    user_message: str,
    limit: int = 5,
):
    results = search_documents(
        org_id=org_id,
        query=user_message,
        limit=limit,
    )

    if results:
        return results

    fallback_docs = get_documents(org_id)
    return fallback_docs[:limit]

