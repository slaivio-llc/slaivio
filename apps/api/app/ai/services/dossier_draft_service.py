from app.ai.repositories.dossier_draft_repository import create_dossier_draft
from app.ai.services.dossier_missing_fields import get_dossier_missing_fields
from app.ai.services.intent_detector import detect_intent


def prepare_dossier_draft_from_message(
    org_id: str,
    client_phone: str,
    source_message: str,
    workflow_id: str | None = None,
    manager_id: str | None = None,
    manager_name: str | None = None,
):
    intent_result = detect_intent(
        org_id=org_id,
        message=source_message,
    )
    entities = intent_result.get("entities", {})
    missing_fields = get_dossier_missing_fields(entities)

    draft = create_dossier_draft(
        org_id=org_id,
        client_phone=client_phone,
        source_message=source_message,
        workflow_id=workflow_id,
        case_type="SEND_CARGO",
        origin_country=entities.get("origin_country"),
        origin_city=entities.get("origin_city"),
        destination_country=entities.get("destination_country"),
        destination_city=entities.get("destination_city"),
        goods_type=entities.get("goods_type"),
        estimated_weight_kg=entities.get("weight_kg"),
        estimated_volume_cbm=entities.get("volume_cbm"),
        shipping_mode=entities.get("shipping_mode"),
        missing_fields=missing_fields,
        manager_id=manager_id,
        manager_name=manager_name,
    )

    return {
        "status": "ok",
        "intent": intent_result,
        "draft": draft,
    }

