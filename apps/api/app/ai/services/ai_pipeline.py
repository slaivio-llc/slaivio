from app.ai.prompts.prompt_builder import (
    build_messages,
    build_system_prompt,
)
from app.ai.providers.provider_factory import get_provider
from app.ai.repositories.ai_settings_repository import get_ai_settings
from app.ai.repositories.memory_repository import (
    get_recent_memory,
    store_memory,
)
from app.ai.services.knowledge_retrieval import retrieve_relevant_knowledge


def run_ai_pipeline(
    org_id: str,
    client_phone: str,
    user_message: str,
    intent_result: dict | None = None,
):
    settings = get_ai_settings(org_id)

    if not settings.get("enabled", True):
        return {
            "success": False,
            "error": "AI_DISABLED",
        }

    knowledge = retrieve_relevant_knowledge(
        org_id=org_id,
        user_message=user_message,
    )
    memory = get_recent_memory(
        org_id=org_id,
        client_phone=client_phone,
    )
    system_prompt = build_system_prompt(knowledge_items=knowledge)
    messages = build_messages(
        system_prompt=system_prompt,
        memory_items=memory,
        user_message=user_message,
    )
    provider = get_provider(settings["provider"])

    result = provider.generate(
        messages=messages,
        model_name=settings["model_name"],
        temperature=float(settings["temperature"]),
        max_tokens=int(settings["max_tokens"]),
    )

    if result.get("success"):
        store_memory(
            org_id=org_id,
            client_phone=client_phone,
            role="user",
            content=user_message,
        )
        store_memory(
            org_id=org_id,
            client_phone=client_phone,
            role="assistant",
            content=result["content"],
        )

    if intent_result:
        return {
            **result,
            "intent": intent_result,
        }

    return result

