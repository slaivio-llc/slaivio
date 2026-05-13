from app.db.manager_event_repository import create_manager_event


def emit_manager_event(
    org_id: str,
    event_type: str,
    title: str,
    message: str,
    event_scope: str = "GENERAL",
    client_id: str | None = None,
    dossier_id: str | None = None,
    shipment_id: str | None = None,
    notification_id: str | None = None,
    escalation_id: str | None = None,
    priority: str = "NORMAL",
    payload: dict | None = None,
):
    return create_manager_event(
        org_id=org_id,
        event_type=event_type,
        title=title,
        message=message,
        event_scope=event_scope,
        client_id=client_id,
        dossier_id=dossier_id,
        shipment_id=shipment_id,
        notification_id=notification_id,
        escalation_id=escalation_id,
        priority=priority,
        payload=payload or {},
    )


def emit_client_message_event(
    org_id: str,
    client_id: str,
    dossier_id: str,
    phone: str,
    text: str | None,
    intent: str | None,
):
    return emit_manager_event(
        org_id=org_id,
        event_type="CLIENT_MESSAGE_RECEIVED",
        event_scope="CLIENT",
        client_id=client_id,
        dossier_id=dossier_id,
        title="Nouveau message client",
        message=f"{phone} : {(text or '')[:120]}",
        priority="NORMAL",
        payload={
            "phone": phone,
            "text": text,
            "intent": intent,
        },
    )


def emit_notification_event(
    org_id: str,
    notification_id: str,
    dossier_id: str | None,
    title: str,
    message: str,
    status: str,
):
    return emit_manager_event(
        org_id=org_id,
        event_type="NOTIFICATION_UPDATED",
        event_scope="NOTIFICATION",
        notification_id=notification_id,
        dossier_id=dossier_id,
        title=title,
        message=message,
        priority="NORMAL",
        payload={
            "status": status,
        },
    )


def emit_escalation_event(
    org_id: str,
    escalation_id: str,
    client_id: str | None,
    dossier_id: str | None,
    reason: str,
    priority: str,
):
    return emit_manager_event(
        org_id=org_id,
        event_type="ESCALATION_CREATED",
        event_scope="ESCALATION",
        client_id=client_id,
        dossier_id=dossier_id,
        escalation_id=escalation_id,
        title="Escalade créée",
        message=f"Raison : {reason}",
        priority=priority,
        payload={
            "reason": reason,
        },
    )
