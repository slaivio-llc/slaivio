from sqlalchemy import text

from app.db.database import engine


def get_wallet(
    org_id: str,
    currency_code: str = "USD",
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from agency_wallets
                where org_id = :org_id
                  and currency_code = :currency_code
                limit 1
            """),
            {
                "org_id": org_id,
                "currency_code": currency_code,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def get_or_create_wallet(
    org_id: str,
    currency_code: str = "USD",
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into agency_wallets (
                    org_id,
                    currency_code
                )
                values (
                    :org_id,
                    :currency_code
                )
                on conflict (org_id)
                do update set updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "currency_code": currency_code,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def update_wallet_balance(
    wallet_id: str,
    delta_minor: int,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update agency_wallets
                set
                    balance_minor = balance_minor + :delta_minor,
                    updated_at = now()
                where id = :wallet_id
                returning *
            """),
            {
                "wallet_id": wallet_id,
                "delta_minor": delta_minor,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None
