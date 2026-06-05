from app.financial.repositories.audit_repository import create_financial_audit_log
from app.financial.repositories.financial_event_repository import create_financial_event


def record_money_event(
    org_id: str,
    event_type: str,
    amount_minor: int,
    currency_code: str = "USD",
    source_type: str | None = None,
    source_id: str | None = None,
    description: str | None = None,
    metadata: dict | None = None,
    actor_id: str | None = None,
):
    event = create_financial_event(
        org_id=org_id,
        event_type=event_type,
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type=source_type,
        source_id=source_id,
        description=description,
        metadata=metadata,
    )

    create_financial_audit_log(
        org_id=org_id,
        actor_id=actor_id,
        action=f"financial_event:{event_type}",
        entity_type="financial_event",
        entity_id=str(event["id"]) if event else None,
        after_state=event,
    )

    return event

