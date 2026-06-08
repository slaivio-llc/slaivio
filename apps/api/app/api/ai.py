from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.ai.repositories.intent_repository import log_intent_detection
from app.ai.services.ai_pipeline import run_ai_pipeline
from app.ai.services.escalation_engine import evaluate_escalation
from app.ai.services.intent_detector import detect_intent
from app.ai.services.knowledge_retrieval import retrieve_relevant_knowledge
from app.ai.services.response_orchestrator import orchestrate_ai_response


router = APIRouter()


class AITestRequest(BaseModel):
    client_phone: str = "test_client"
    message: str


@router.post("/ai/test")
def ai_test(body: AITestRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return run_ai_pipeline(
        org_id=org_id,
        client_phone=body.client_phone,
        user_message=body.message,
    )


@router.post("/ai/retrieve")
def ai_retrieve(body: AITestRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "documents": retrieve_relevant_knowledge(
            org_id=org_id,
            user_message=body.message,
        ),
    }


@router.post("/ai/intent")
def ai_intent(body: AITestRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    result = detect_intent(
        org_id=org_id,
        message=body.message,
    )
    log_intent_detection(
        org_id=org_id,
        client_phone=body.client_phone,
        message=body.message,
        intent=result["intent"],
        confidence=result["confidence"],
        entities=result["entities"],
        raw_response=result["raw_response"],
    )

    return {
        "status": "ok",
        **result,
    }


@router.post("/ai/orchestrate")
def ai_orchestrate(body: AITestRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return orchestrate_ai_response(
        org_id=org_id,
        client_phone=body.client_phone,
        user_message=body.message,
    )


@router.post("/ai/escalation")
def escalation_test(body: AITestRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    intent_result = detect_intent(
        org_id=org_id,
        message=body.message,
    )
    return evaluate_escalation(
        org_id=org_id,
        client_phone=body.client_phone,
        message=body.message,
        intent=intent_result["intent"],
        confidence=intent_result["confidence"],
    )
