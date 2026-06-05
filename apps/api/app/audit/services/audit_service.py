from app.audit.repositories.audit_repository import create_audit_log


def audit_event(
    org_id: str,
    actor_id: str,
    actor_name: str,
    actor_role: str | None,
    entity_type: str,
    entity_id: str | None,
    action: str,
    old_data=None,
    new_data=None,
    metadata=None,
    ip_address=None,
    user_agent=None,
    severity="INFO",
):
    return create_audit_log(
        org_id=org_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_data=old_data,
        new_data=new_data,
        metadata=metadata,
        ip_address=ip_address,
        user_agent=user_agent,
        severity=severity,
    )

