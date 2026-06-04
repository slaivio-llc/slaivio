from app.ai.repositories.workflow_repository import create_workflow_run
from app.ai.services.intent_detector import detect_intent
from app.ai.services.workflow_actions import build_proposed_actions
from app.ai.services.workflow_mapping import get_workflow_type


def prepare_ai_workflow(
    org_id: str,
    client_phone: str,
    source_message: str,
    manager_id: str | None = None,
    manager_name: str | None = None,
):
    intent_result = detect_intent(
        org_id=org_id,
        message=source_message,
    )
    intent = intent_result["intent"]
    confidence = intent_result["confidence"]
    entities = intent_result["entities"]
    workflow_type = get_workflow_type(intent)
    proposed_actions = build_proposed_actions(
        workflow_type=workflow_type,
        entities=entities,
    )
    workflow = create_workflow_run(
        org_id=org_id,
        client_phone=client_phone,
        source_message=source_message,
        intent=intent,
        confidence=confidence,
        workflow_type=workflow_type,
        entities=entities,
        proposed_actions=proposed_actions,
        manager_id=manager_id,
        manager_name=manager_name,
    )

    return {
        "status": "ok",
        "intent": intent_result,
        "workflow": workflow,
    }

