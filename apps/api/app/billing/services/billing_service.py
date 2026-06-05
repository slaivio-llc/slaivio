from app.billing.repositories.invoice_repository import (
    create_invoice,
    get_invoice,
    list_invoices,
    mark_invoice_paid,
)
from app.billing.repositories.payment_repository import create_billing_payment
from app.billing.repositories.plan_repository import get_pricing_plan
from app.billing.repositories.subscription_repository import (
    get_subscription,
    update_subscription_status,
    upsert_subscription,
)
from app.billing.services.billing_cycle_service import monthly_window, trial_window
from app.billing.services.invoice_number_service import generate_invoice_number
from app.financial.services.financial_service import record_money_event


def start_trial_subscription(
    org_id: str,
    plan_code: str = "STARTER",
):
    plan = get_pricing_plan(plan_code)

    if not plan:
        raise ValueError("pricing_plan_not_found")

    window = trial_window()

    return upsert_subscription(
        org_id=org_id,
        plan_id=str(plan["id"]),
        status="TRIAL",
        starts_at=window["starts_at"],
        trial_ends_at=window["trial_ends_at"],
        current_period_ends_at=window["current_period_ends_at"],
    )


def create_monthly_invoice(
    org_id: str,
):
    subscription = get_subscription(org_id)

    if not subscription:
        raise ValueError("subscription_not_found")

    amount_minor = int(subscription.get("monthly_price_minor") or 0)

    invoice = create_invoice(
        org_id=org_id,
        subscription_id=str(subscription["id"]),
        invoice_number=generate_invoice_number(),
        amount_minor=amount_minor,
        currency_code="USD",
        metadata={
            "plan_name": subscription.get("plan_name"),
        },
    )

    record_money_event(
        org_id=org_id,
        event_type="INVOICE_CREATED",
        amount_minor=amount_minor,
        currency_code="USD",
        source_type="billing_invoice",
        source_id=str(invoice["id"]) if invoice else None,
        description="Monthly subscription invoice created",
    )

    return invoice


def confirm_invoice_payment(
    org_id: str,
    invoice_id: str,
    provider: str | None = None,
    provider_payment_id: str | None = None,
    idempotency_key: str | None = None,
):
    invoice = get_invoice(invoice_id)

    if not invoice:
        raise ValueError("invoice_not_found")

    payment = create_billing_payment(
        org_id=org_id,
        invoice_id=invoice_id,
        amount_minor=invoice["total_minor"],
        currency_code=invoice["currency_code"],
        provider=provider,
        provider_payment_id=provider_payment_id,
        status="SUCCEEDED",
        idempotency_key=idempotency_key,
    )

    paid_invoice = mark_invoice_paid(invoice_id)
    subscription = update_subscription_status(org_id, "ACTIVE")

    record_money_event(
        org_id=org_id,
        event_type="INVOICE_PAYMENT",
        amount_minor=invoice["total_minor"],
        currency_code=invoice["currency_code"],
        source_type="billing_payment",
        source_id=str(payment["id"]) if payment else None,
        description="Subscription invoice paid",
    )

    return {
        "payment": payment,
        "invoice": paid_invoice,
        "subscription": subscription,
    }


def get_billing_overview(
    org_id: str,
):
    return {
        "subscription": get_subscription(org_id),
        "invoices": list_invoices(org_id),
    }

