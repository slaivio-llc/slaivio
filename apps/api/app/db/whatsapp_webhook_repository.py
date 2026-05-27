from sqlalchemy import text

from app.db.database import engine


def update_waba_webhook_status(
    org_id: str,
    waba_id: str,
    status: str,
    raw_response: dict | None = None,
    error_message: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update organization_whatsapp_accounts
                set
                    webhook_subscription_status = :status,
                    webhook_last_checked_at = now(),
                    webhook_subscribed_at = case
                        when :status = 'SUBSCRIBED' then now()
                        else webhook_subscribed_at
                    end,
                    webhook_raw_response = :raw_response,
                    webhook_error_message = :error_message,
                    updated_at = now()
                where org_id = :org_id
                  and waba_id = :waba_id
                returning *
            """),
            {
                "org_id": org_id,
                "waba_id": waba_id,
                "status": status,
                "raw_response": raw_response,
                "error_message": error_message,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def get_whatsapp_account_by_waba(
    org_id: str,
    waba_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from organization_whatsapp_accounts
                where org_id = :org_id
                  and waba_id = :waba_id
                limit 1
            """),
            {
                "org_id": org_id,
                "waba_id": waba_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
