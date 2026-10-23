from app.billing.repositories.invoice_repository import (
    create_invoice,
    get_invoice,
    list_invoices,
    mark_invoice_paid,
)
from app.billing.repositories.payment_repository import create_billing_payment
from app.billing.repositories.subscription_repository import (
    get_subscription,
    update_subscription_status,
)
from app.billing.services.invoice_number_service import generate_invoice_number
from app.financial.services.financial_service import record_money_event


def start_trial_subscription(
    org_id: str,
    plan_code: str = "STARTER",
):
    from app.billing.repositories.saspay_repository import ensure_trial
    if plan_code != 'STARTER':
        raise ValueError('trial_plan_not_available')
    return ensure_trial(org_id)


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
    if invoice['org_id'] != org_id:
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
    from sqlalchemy import text
    from app.billing.repositories.saspay_repository import account_id, ensure_trial, pending_checkout
    from app.billing.services.saspay_client import configured
    from app.billing.services.saspay_service import subscription_access
    org_id = account_id(org_id)
    ensure_trial(org_id)
    from app.db.database import engine
    with engine.connect() as connection:
        usage=dict(connection.execute(text("""select
            (select count(*) from clients where org_id=:org and deleted_at is null) clients,
            (select count(*) from cargo_packages where org_id=:org and deleted_at is null) packages,
            (select count(*) from organization_memberships where org_id=:org and status='ACTIVE') members,
            (select count(*) from organization_locations where org_id=:org and status='ACTIVE' and location_type='OFFICE') offices
            """),{'org':org_id}).mappings().one())
    subscription = get_subscription(org_id)
    return {
        "billing_account_id":org_id,
        "subscription": subscription,
        "access_active":subscription_access(subscription),
        "trial_days":30,
        "checkout_available":configured(),
        "pending_checkout":pending_checkout(org_id),
        "invoices": list_invoices(org_id),
        "usage":usage,
    }

