from app.commercial.engines.goods_rule_engine import check_goods_restriction
from app.commercial.repositories.commercial_repository import (
    create_commercial_case,
    create_commercial_dossier,
    create_commercial_event,
    create_commercial_task,
    create_restriction_check,
    get_or_create_client,
)


def create_restriction_flow(
    org_id: str,
    fields: dict,
    source_channel: str = "dashboard",
    last_customer_message: str | None = None,
):
    client = get_or_create_client(
        org_id=org_id,
        phone=fields.get("phone"),
        client_id=fields.get("client_id"),
    )
    dossier = create_commercial_dossier(
        org_id=org_id,
        client_id=str(client["id"]),
        case_type="RESTRICTION_CHECK",
        fields=fields,
    )
    restriction = check_goods_restriction(
        org_id=org_id,
        goods_description=fields.get("goods_description"),
        goods_category=fields.get("goods_category"),
    )
    commercial_case = create_commercial_case(
        org_id=org_id,
        client_id=str(client["id"]),
        dossier_id=str(dossier["id"]),
        source_channel=source_channel,
        case_type="RESTRICTION_CHECK",
        status="NEEDS_INFO" if restriction["escalation_required"] else "CLOSED",
        priority="HIGH" if restriction["escalation_required"] else "NORMAL",
        detected_intent="RESTRICTION_CHECK",
        extracted_fields=fields,
        assigned_team="compliance",
        last_customer_message=last_customer_message,
    )
    check = create_restriction_check(
        org_id=org_id,
        commercial_case_id=str(commercial_case["id"]),
        dossier_id=str(dossier["id"]),
        client_id=str(client["id"]),
        fields=fields,
        restriction=restriction,
    )

    task = None
    if restriction["escalation_required"]:
        task = create_commercial_task(
            org_id=org_id,
            commercial_case_id=str(commercial_case["id"]),
            dossier_id=str(dossier["id"]),
            task_type="COMPLIANCE_REVIEW",
            title="Verifier restriction marchandise",
            description=restriction.get("handling_instructions"),
            priority="HIGH",
            assigned_team="compliance",
            metadata={
                "restriction_check_id": str(check["id"]),
                "decision": restriction["decision"],
            },
        )

    create_commercial_event(
        org_id=org_id,
        commercial_case_id=str(commercial_case["id"]),
        dossier_id=str(dossier["id"]),
        event_type="RESTRICTION_CHECK_CREATED",
        event_title="Controle restriction cree",
        event_payload={
            "restriction_check_id": str(check["id"]),
            "decision": restriction["decision"],
        },
    )

    return {
        "status": "restriction_checked",
        "case": commercial_case,
        "dossier": dossier,
        "restriction_check": check,
        "restriction": restriction,
        "task": task,
    }
