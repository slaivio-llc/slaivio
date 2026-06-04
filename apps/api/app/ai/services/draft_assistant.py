from app.ai.repositories.draft_response_repository import create_ai_draft
from app.ai.services.response_orchestrator import orchestrate_ai_response


def generate_inbox_draft(
    org_id: str,
    client_phone: str,
    source_message: str,
    manager_id: str | None = None,
    manager_name: str | None = None,
):
    result = orchestrate_ai_response(
        org_id=org_id,
        client_phone=client_phone,
        user_message=source_message,
    )
    draft_text = result.get("response_text") or (
        "Merci pour votre message. "
        "Un membre de notre équipe va vous assister."
    )

    draft = create_ai_draft(
        org_id=org_id,
        client_phone=client_phone,
        source_message=source_message,
        draft_text=draft_text,
        intent=result.get("intent", {}).get("intent"),
        decision=result.get("decision"),
        manager_id=manager_id,
        manager_name=manager_name,
    )

    return {
        "status": "ok",
        "draft": draft,
        "orchestration": result,
    }

