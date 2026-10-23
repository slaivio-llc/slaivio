import json
from uuid import uuid4
from sqlalchemy import text
from fastapi import HTTPException
from app.db.database import engine


def account_id(org_id, connection=None):
    if connection is not None:
        return connection.execute(text("select coalesce(parent_org_id,id) from organizations where id=:org"), {"org": org_id}).scalar_one()
    with engine.connect() as conn:
        return account_id(org_id, conn)


def ensure_trial(org_id):
    with engine.begin() as conn:
        org_id = account_id(org_id, conn)
        conn.execute(text("""insert into agency_subscriptions(org_id,pricing_plan_id,status,trial_ends_at,ends_at,auto_renew)
            select :org,id,'TRIAL',now()+interval '30 days',now()+interval '30 days',false
            from pricing_plans where code='STARTER' and active=true
            on conflict(org_id) do nothing"""), {"org": org_id})
        row = conn.execute(text("select * from agency_subscriptions where org_id=:org"), {"org": org_id}).mappings().first()
        if not row:
            raise HTTPException(503, "billing_plan_unavailable")
        return dict(row)


def reserve_checkout(org_id, plan_code):
    with engine.begin() as conn:
        org_id = account_id(org_id, conn)
        conn.execute(text("select pg_advisory_xact_lock(hashtext(:key))"), {"key": f"subscription-checkout:{org_id}"})
        pending = conn.execute(text("""select c.*,p.code as plan_code from billing_checkout_sessions c
            join pricing_plans p on p.id=c.pricing_plan_id where c.org_id=:org and c.status in ('CREATING','PENDING','UNKNOWN')"""), {"org": org_id}).mappings().first()
        if pending:
            if pending['plan_code'] != plan_code:
                raise HTTPException(409,'billing_checkout_plan_locked')
            return dict(pending), False
        plan = conn.execute(text("select * from pricing_plans where code=:code and active=true"), {"code": plan_code}).mappings().first()
        if not plan or plan['monthly_price_minor'] <= 0:
            raise HTTPException(422, "billing_plan_unavailable")
        from app.billing.services.saspay_client import allowed_currencies
        if plan['currency_code'] not in allowed_currencies():
            raise HTTPException(422,'billing_currency_not_enabled')
        subscription = conn.execute(text("select id from agency_subscriptions where org_id=:org"), {"org": org_id}).scalar_one()
        attempt_id, invoice_id = str(uuid4()), str(uuid4())
        conn.execute(text("""insert into billing_invoices(id,org_id,subscription_id,invoice_number,status,amount_minor,total_minor,currency_code,metadata)
            values(cast(:invoice as uuid),:org,:subscription,:number,'OPEN',:amount,:amount,:currency,cast(:metadata as jsonb))"""),
            {"invoice": invoice_id, "org": org_id, "subscription": subscription, "number": f"SLA-{uuid4().hex.upper()}",
             "amount": plan['monthly_price_minor'], "currency": plan['currency_code'], "metadata": json.dumps({"provider": "SASPAY", "plan_code": plan_code})})
        row = conn.execute(text("""insert into billing_checkout_sessions(id,org_id,invoice_id,pricing_plan_id,amount_minor,currency_code)
            values(cast(:id as uuid),:org,cast(:invoice as uuid),:plan,:amount,:currency) returning *"""),
            {"id": attempt_id, "org": org_id, "invoice": invoice_id, "plan": plan['id'], "amount": plan['monthly_price_minor'], "currency": plan['currency_code']}).mappings().one()
        return dict(row), True


def get_checkout(attempt_id, org_id=None):
    with engine.connect() as conn:
        account = account_id(org_id, conn) if org_id else None
        row = conn.execute(text("select * from billing_checkout_sessions where id=cast(:id as uuid) and (:org is null or org_id=:org)"), {"id": attempt_id, "org": account}).mappings().first()
        if not row:
            raise HTTPException(404, "billing_checkout_not_found")
        return dict(row)


def pending_checkout(org_id):
    with engine.connect() as conn:
        row=conn.execute(text("""select c.id,c.status,p.code as plan_code from billing_checkout_sessions c
            join pricing_plans p on p.id=c.pricing_plan_id
            where c.org_id=:org and c.status in ('CREATING','PENDING','UNKNOWN') limit 1"""),{'org':org_id}).mappings().first()
        return dict(row) if row else None


def pending_reconciliation(limit=25):
    with engine.connect() as conn:
        return [str(row[0]) for row in conn.execute(text("""select id from billing_checkout_sessions
            where status in ('CREATING','PENDING','UNKNOWN') and created_at<now()-interval '1 minute'
            order by updated_at limit :limit"""),{'limit':limit})]


def touch_checkout(attempt_id):
    with engine.begin() as conn:
        conn.execute(text("update billing_checkout_sessions set updated_at=now() where id=cast(:id as uuid)"),{'id':attempt_id})


def update_checkout(attempt_id, status, session_id=None, checkout_url=None, transaction_id=None, expires_at=None):
    with engine.begin() as conn:
        conn.execute(text("""update billing_checkout_sessions set status=:status,
            provider_session_id=coalesce(:session,provider_session_id),checkout_url=coalesce(:url,checkout_url),
            provider_transaction_id=coalesce(:transaction,provider_transaction_id),
            expires_at=coalesce(cast(:expires as timestamptz),expires_at),updated_at=now()
            where id=cast(:id as uuid) and status<>'SUCCESS'"""),
            {"id": attempt_id,"status":status,"session":session_id,"url":checkout_url,"transaction":transaction_id,"expires":expires_at})


def settle_checkout(attempt_id, transaction_id, financial):
    """One DB transaction: lock, payment, invoice and paid access period."""
    with engine.begin() as conn:
        attempt = conn.execute(text("select * from billing_checkout_sessions where id=cast(:id as uuid) for update"), {"id": attempt_id}).mappings().one()
        if attempt['status'] == 'SUCCESS':
            return
        invoice = conn.execute(text("select * from billing_invoices where id=:id and org_id=:org for update"), {"id":attempt['invoice_id'],"org":attempt['org_id']}).mappings().one()
        if invoice['status'] == 'PAID':
            return
        if invoice['status'] != 'OPEN':
            raise HTTPException(409,'billing_invoice_not_payable')
        if invoice['total_minor'] != attempt['amount_minor'] or invoice['currency_code'] != attempt['currency_code']:
            raise HTTPException(409,'saspay_payment_mismatch')
        conn.execute(text("""insert into billing_payments(org_id,invoice_id,amount_minor,currency_code,payment_method,provider,provider_payment_id,provider_reference,status,paid_at,idempotency_key)
            values(:org,:invoice,:amount,:currency,'SASPAY','SASPAY',:transaction,:transaction,'SUCCEEDED',now(),:key)"""),
            {"org":attempt['org_id'],"invoice":attempt['invoice_id'],"amount":attempt['amount_minor'],"currency":attempt['currency_code'],"transaction":transaction_id,"key":f"saspay:{transaction_id}"})
        conn.execute(text("""update billing_invoices set status='PAID',amount_paid_minor=total_minor,paid_at=now(),
            metadata=coalesce(metadata,'{}'::jsonb)||cast(:data as jsonb),updated_at=now() where id=:id"""),
            {"id":attempt['invoice_id'],"data":json.dumps(financial)})
        conn.execute(text("""update agency_subscriptions set pricing_plan_id=:plan,status='ACTIVE',auto_renew=false,
            ends_at=greatest(now(),coalesce(ends_at,now()))+interval '1 month',updated_at=now() where org_id=:org"""),
            {"org":attempt['org_id'],"plan":attempt['pricing_plan_id']})
        conn.execute(text("""update billing_checkout_sessions set status='SUCCESS',provider_transaction_id=:transaction,
            verified_at=now(),updated_at=now() where id=cast(:id as uuid)"""), {"id":attempt_id,"transaction":transaction_id})
        conn.execute(text("""insert into subscription_access_logs(org_id,subscription_id,new_status,reason)
            values(:org,:subscription,'ACTIVE',:reason)"""),
            {"org":attempt['org_id'],"subscription":invoice['subscription_id'],"reason":f"Paiement SasPay vérifié : {transaction_id}"})
