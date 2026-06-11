from app.commercial.repositories.commercial_repository import (
    create_commercial_case,
    create_commercial_dossier,
    create_commercial_event,
    create_commercial_task,
    create_procurement_request,
    get_or_create_client,
)


def create_procurement_flow(
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
        case_type="PROCUREMENT_REQUEST",
        fields=fields,
    )
    commercial_case = create_commercial_case(
        org_id=org_id,
        client_id=str(client["id"]),
        dossier_id=str(dossier["id"]),
        source_channel=source_channel,
        case_type="PROCUREMENT_REQUEST",
        status="IN_PROGRESS",
        detected_intent="PROCUREMENT_REQUEST",
        extracted_fields=fields,
        assigned_team="procurement",
        last_customer_message=last_customer_message,
    )
    procurement = create_procurement_request(
        org_id=org_id,
        commercial_case_id=str(commercial_case["id"]),
        dossier_id=str(dossier["id"]),
        client_id=str(client["id"]),
        fields=fields,
    )
    task = create_commercial_task(
        org_id=org_id,
        commercial_case_id=str(commercial_case["id"]),
        dossier_id=str(dossier["id"]),
        task_type="SOURCE_PRODUCT",
        title="Lancer sourcing produit",
        description=fields.get("product_description"),
        assigned_team="procurement",
        metadata={
            "procurement_request_id": str(procurement["id"]),
        },
    )
    create_commercial_event(
        org_id=org_id,
        commercial_case_id=str(commercial_case["id"]),
        dossier_id=str(dossier["id"]),
        event_type="PROCUREMENT_CREATED",
        event_title="Demande achat creee",
        event_payload={
            "procurement_request_id": str(procurement["id"]),
        },
    )

    return {
        "status": "procurement_created",
        "case": commercial_case,
        "dossier": dossier,
        "procurement": procurement,
        "task": task,
    }
