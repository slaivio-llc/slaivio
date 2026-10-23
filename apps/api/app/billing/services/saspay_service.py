from decimal import Decimal
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException
from app.core.config import settings
from app.billing.repositories import saspay_repository as repo
from app.billing.services import saspay_client as provider


def start_checkout(org_id, plan_code, email, name):
    if not provider.configured():
        raise HTTPException(503, "saspay_not_configured")
    repo.ensure_trial(org_id)
    attempt, created = repo.reserve_checkout(org_id, plan_code)
    if not created:
        if attempt['status']=='UNKNOWN':
            attempt=recover_session(attempt)
        if attempt['status'] == 'PENDING' and attempt.get('checkout_url'):
            return {"id":str(attempt['id']),"checkout_url":provider.safe_checkout_url(attempt['checkout_url']),"status":"PENDING"}
        raise HTTPException(409, "billing_checkout_creation_uncertain")
    attempt_id = str(attempt['id'])
    # SasPay checkout creation is NOT idempotent. Never retry a POST after an
    # ambiguous timeout: the local reservation remains available for recovery.
    try:
        session = provider.request("POST", "/checkout-sessions/", {
            "amount":format(Decimal(attempt['amount_minor'])/100,".2f"),"currency":attempt['currency_code'],
            "customer_email":email,"customer_name":name,
            "description":f"Abonnement SLAIVIO / {attempt_id}",
            "metadata":{"slaivio_checkout_id":attempt_id},
            "return_url":settings.public_web_base_url.rstrip('/')+f"/app/settings?section=subscription&checkout={attempt_id}",
        })
        session_id = provider.checkout_id(session.get('id'))
        url = provider.safe_checkout_url(session.get('checkout_url'))
        validate_amounts(session, attempt, "amount")
        repo.update_checkout(attempt_id,"PENDING",session_id=session_id,checkout_url=url,expires_at=session.get('expires_at'))
        return {"id":attempt_id,"checkout_url":url,"status":"PENDING"}
    except Exception:
        repo.update_checkout(attempt_id,"UNKNOWN")
        raise


def validate_amounts(remote, attempt, amount_key):
    if (str(remote.get('merchant')) != settings.saspay_merchant_id
        or remote.get('currency') != attempt['currency_code']
        or provider.minor_amount(remote.get(amount_key)) != attempt['amount_minor']):
        raise HTTPException(409, "saspay_payment_mismatch")


def recover_session(attempt):
    """Read-only recovery after an ambiguous POST. Never create a second charge."""
    if attempt['status']=='CREATING':
        created=attempt.get('created_at')
        if created and (datetime.now(timezone.utc)-created).total_seconds()<45:
            raise HTTPException(409,'billing_checkout_creation_uncertain')
    for page in range(1,4):
        result=provider.request('GET',f'/checkout-sessions/?page={page}')
        for remote in result.get('results',[]):
            if remote.get('description') != f"Abonnement SLAIVIO / {attempt['id']}":
                continue
            validate_amounts(remote,attempt,'amount')
            session_id=provider.checkout_id(remote.get('id'))
            url=provider.safe_checkout_url(remote.get('checkout_url'))
            repo.update_checkout(str(attempt['id']),'PENDING',session_id=session_id,checkout_url=url,expires_at=remote.get('expires_at'))
            return {**attempt,'provider_session_id':session_id,'checkout_url':url,'status':'PENDING'}
        if not result.get('next'):
            break
    raise HTTPException(409,'billing_checkout_creation_uncertain')


def verify_checkout(attempt_id, org_id=None, verified_payment=None, verified_session=None):
    attempt = repo.get_checkout(attempt_id,org_id)
    if not attempt.get('provider_session_id'):
        attempt=recover_session(attempt)
    session = verified_session or provider.request("GET",f"/checkout-sessions/{provider.checkout_id(attempt['provider_session_id'])}/")
    if str(session.get('id')) != attempt['provider_session_id']:
        raise HTTPException(409,"saspay_payment_mismatch")
    validate_amounts(session,attempt,"amount")
    transaction = session.get('transaction')
    transaction_id = transaction.get('id') if isinstance(transaction,dict) else transaction
    if not transaction_id:
        if session.get('status') in ('CANCELLED','EXPIRED','FAILED'):
            repo.update_checkout(str(attempt['id']),"FAILED")
            return {"id":str(attempt['id']),"status":"FAILED"}
        return {"id":str(attempt['id']),"status":"PENDING"}
    transaction_id = provider.checkout_id(transaction_id)
    payment = verified_payment or provider.request("GET",f"/payments/{transaction_id}/verify/")
    if str(payment.get('id')) != transaction_id or payment.get('flow_direction') != 'INBOUND' or payment.get('transaction_type') != 'PAIEMENT':
        raise HTTPException(409,"saspay_payment_mismatch")
    validate_amounts(payment,attempt,"requested_amount")
    if payment.get('status') == 'SUCCESS':
        # Preserve the provider's actual charged and net values, never substitute
        # the nominal subscription price for either accounting amount.
        financial = {key:payment.get(key) for key in ('requested_amount','debited_amount','net_amount','client_fee','fee_charge_mode','currency')}
        repo.settle_checkout(str(attempt['id']),transaction_id,financial)
        return {"id":str(attempt['id']),"status":"SUCCESS"}
    status = "FAILED" if payment.get('status') in ('FAILED','CANCELLED') else "PENDING"
    repo.update_checkout(str(attempt['id']),status,transaction_id=transaction_id)
    return {"id":str(attempt['id']),"status":status}


def process_webhook(event):
    if event.get('event') not in ('transaction.success','transaction.failed'):
        return {"received":True}
    payment_id = provider.checkout_id((event.get('data') or {}).get('id'))
    payment = provider.request("GET",f"/payments/{payment_id}/verify/")
    # Resolve only a reference returned by the authenticated provider. Then the
    # session->transaction binding is independently verified before settlement.
    try:
        attempt_id = str(UUID(str(payment.get('description','')).rsplit(' / ',1)[-1]))
    except ValueError:
        return {"received":True,"ignored":True}
    attempt = repo.get_checkout(attempt_id)
    session_id = attempt.get('provider_session_id')
    if not session_id:
        raise HTTPException(503,"billing_checkout_reconciliation_required")
    session = provider.request("GET",f"/checkout-sessions/{provider.checkout_id(session_id)}/")
    transaction = session.get('transaction')
    bound = transaction.get('id') if isinstance(transaction,dict) else transaction
    if str(bound) != payment_id:
        raise HTTPException(409,"saspay_payment_mismatch")
    return verify_checkout(attempt_id,verified_payment=payment,verified_session=session)


def subscription_access(subscription, now=None):
    if not subscription:
        return False
    status = subscription.get('status')
    deadline = subscription.get('trial_ends_at') if status == 'TRIAL' else subscription.get('grace_until') if status == 'GRACE' else subscription.get('ends_at')
    if status not in ('TRIAL','ACTIVE','GRACE'):
        return False
    if deadline is None:
        return status == 'ACTIVE'  # Existing explicit lifetime/admin grants.
    if isinstance(deadline,str):
        deadline = datetime.fromisoformat(deadline.replace('Z','+00:00'))
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return deadline > (now or datetime.now(timezone.utc))
