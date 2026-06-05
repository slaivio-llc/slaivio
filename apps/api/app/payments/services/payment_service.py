from app.financial.services.financial_service import record_money_event
from app.payments.providers.mock_provider import MockPaymentProvider
from app.payments.repositories.payment_repository import (
    create_payment_request_record,
    get_payment_provider,
    list_payment_providers,
    list_payment_requests,
    update_payment_request_status,
)


def resolve_payment_provider(
    provider_code: str,
):
    provider = get_payment_provider(provider_code)

    if not provider:
        raise ValueError("payment_provider_not_found")

    # Real MTN/Orange/Wave connectors can plug into this factory later.
    return MockPaymentProvider()


def create_payment_request(
    org_id: str,
    provider_code: str,
    amount_minor: int,
    currency_code: str,
    customer_phone: str,
    description: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
):
    provider = resolve_payment_provider(provider_code)

    result = provider.create_payment_request(
        amount_minor=amount_minor,
        currency_code=currency_code,
        customer_phone=customer_phone,
        description=description,
    )

    request = create_payment_request_record(
        org_id=org_id,
        provider_code=provider_code,
        amount_minor=amount_minor,
        currency_code=currency_code,
        customer_phone=customer_phone,
        description=description,
        provider_reference=result.get("provider_reference"),
        status=result.get("status", "PENDING"),
        source_type=source_type,
        source_id=source_id,
        idempotency_key=idempotency_key,
        raw_response=result.get("raw_response"),
    )

    record_money_event(
        org_id=org_id,
        event_type="PAYMENT_REQUEST_CREATED",
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type="payment_request",
        source_id=str(request["id"]) if request else None,
        description=description or "Payment request created",
    )

    return {
        "request": request,
        "provider_result": result,
    }


def refresh_payment_status(
    org_id: str,
    provider_code: str,
    provider_reference: str,
):
    provider = resolve_payment_provider(provider_code)
    result = provider.check_payment_status(provider_reference)

    request = update_payment_request_status(
        provider_reference=provider_reference,
        status=result["status"],
        raw_response=result.get("raw_response"),
    )

    if result["status"] == "SUCCEEDED" and request:
        record_money_event(
            org_id=org_id,
            event_type="PAYMENT_RECEIVED",
            amount_minor=request["amount_minor"],
            currency_code=request["currency_code"],
            source_type="payment_request",
            source_id=str(request["id"]),
            description="External payment received",
        )

    return {
        "request": request,
        "provider_result": result,
    }


def get_payments_overview(
    org_id: str,
):
    return {
        "providers": list_payment_providers(),
        "requests": list_payment_requests(org_id),
    }

