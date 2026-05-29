from sqlalchemy import text
from app.db.database import engine


def upsert_whatsapp_account(
   org_id: str,
   provider: str = "META",
   business_id: str | None = None,
   waba_id: str | None = None,
   account_name: str | None = None,
   access_token: str | None = None,
   connection_status: str = "CONNECTED",
   is_default: bool = False,
   raw_payload: dict | None = None,
):
   with engine.connect() as conn:
       row = conn.execute(
           text("""
               insert into organization_whatsapp_accounts (
                   org_id,
                   provider,
                   business_id,
                   waba_id,
                   account_name,
                   access_token,
                   connection_status,
                   is_default,
                   raw_payload,
                   connected_at,
                   last_sync_at
               )
               values (
                   :org_id,
                   :provider,
                   :business_id,
                   :waba_id,
                   :account_name,
                   :access_token,
                   :connection_status,
                   :is_default,
                   :raw_payload,
                   now(),
                   now()
               )
               on conflict (org_id, waba_id)
               do update set
                   business_id = excluded.business_id,
                   account_name = excluded.account_name,
                   access_token = excluded.access_token,
                   connection_status = excluded.connection_status,
                   is_default = excluded.is_default,
                   raw_payload = excluded.raw_payload,
                   last_sync_at = now(),
                   updated_at = now()
               returning *
           """),
           {
               "org_id": org_id,
               "provider": provider,
               "business_id": business_id,
               "waba_id": waba_id,
               "account_name": account_name,
               "access_token": access_token,
               "connection_status": connection_status,
               "is_default": is_default,
               "raw_payload": raw_payload,
           },
       ).fetchone()

       conn.commit()
       return dict(row._mapping) if row else None


def list_whatsapp_accounts(org_id: str):
   with engine.connect() as conn:
       rows = conn.execute(
           text("""
               select *
               from organization_whatsapp_accounts
               where org_id = :org_id
               order by is_default desc, created_at desc
           """),
           {"org_id": org_id},
       ).fetchall()

       return [dict(row._mapping) for row in rows]


def get_default_whatsapp_account(org_id: str):
   with engine.connect() as conn:
       row = conn.execute(
           text("""
               select *
               from organization_whatsapp_accounts
               where org_id = :org_id
                 and is_default = true
               limit 1
           """),
           {"org_id": org_id},
       ).fetchone()

       return dict(row._mapping) if row else None

