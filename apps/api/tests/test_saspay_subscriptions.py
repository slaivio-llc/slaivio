import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.billing.services import saspay_client as client, saspay_service as service
from app.billing.repositories import saspay_repository as repo
from app.billing.services.billing_cycle_service import trial_window
from app.api import billing
from app.core import tenant_context

ATTEMPT='11111111-1111-4111-8111-111111111111'
SESSION='22222222-2222-4222-8222-222222222222'
PAYMENT='33333333-3333-4333-8333-333333333333'


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(client.settings,'saspay_api_key','sk_test_fake')
    monkeypatch.setattr(client.settings,'saspay_webhook_secret','webhook-test')
    monkeypatch.setattr(client.settings,'saspay_merchant_id','merchant-test')
    monkeypatch.setattr(client.settings,'saspay_billing_currencies','USD')
    monkeypatch.setattr(service,'get_pricing_plan',Mock(return_value={'monthly_price_minor':4900,'currency_code':'USD'}))


def attempt():
    return {'id':ATTEMPT,'org_id':'agency','invoice_id':'invoice','pricing_plan_id':'plan','amount_minor':4900,'currency_code':'USD','provider_session_id':SESSION,'status':'PENDING'}


def session():
    return {'id':SESSION,'merchant':'merchant-test','amount':'49.00','currency':'USD','transaction':PAYMENT,'checkout_url':'https://pay.saspay.me/checkout/abc'}


def payment():
    return {'id':PAYMENT,'merchant':'merchant-test','requested_amount':'49.00','currency':'USD','flow_direction':'INBOUND','transaction_type':'PAIEMENT','status':'SUCCESS',
            'debited_amount':'50.00','net_amount':'49.00','client_fee':'1.00','fee_charge_mode':'ADD_ON','description':f'Abonnement SLAIVIO / {ATTEMPT}'}


def test_trial_is_thirty_days():
    window=trial_window()
    assert datetime.fromisoformat(window['trial_ends_at'])-datetime.fromisoformat(window['starts_at'])==timedelta(days=30)


@pytest.mark.parametrize('status,days,expected', [('TRIAL',1,True),('TRIAL',-1,False),('ACTIVE',1,True),('ACTIVE',-1,False),('CANCELLED',10,False),('SUSPENDED',10,False)])
def test_subscription_expiry_is_checked_server_side(status,days,expected):
    now=datetime.now(timezone.utc)
    assert service.subscription_access({'status':status,'trial_ends_at':now+timedelta(days=days),'ends_at':now+timedelta(days=days)},now)==expected


def test_signature_covers_raw_body_and_timestamp():
    raw=b'{"event":"transaction.success","data":{}}'
    timestamp='123456'
    signature=hmac.new(b'webhook-test',timestamp.encode()+b'.'+raw,hashlib.sha256).hexdigest()
    client.verify_signature(raw,signature,timestamp,now=123456)
    for body,sig,stamp,now in [(raw+b' ',signature,timestamp,123456),(raw,signature,timestamp,123757),(raw,signature,'bad',123456),(raw,'0'*64,timestamp,123456)]:
        with pytest.raises(HTTPException):client.verify_signature(body,sig,stamp,now=now)


def test_non_ascii_signature_is_rejected_as_unauthorized_not_a_server_error():
    with pytest.raises(HTTPException) as error:
        client.verify_signature(b'{}','é'*64,'123456',now=123456)
    assert error.value.status_code==401


def test_test_keys_cannot_activate_production_subscriptions(monkeypatch):
    monkeypatch.setattr(client.settings,'app_env','production')
    assert client.configured() is False
    monkeypatch.setattr(client.settings,'saspay_api_key','sk_live_fake')
    assert client.configured() is True


def test_checkout_stays_disabled_until_merchant_currencies_are_explicitly_confirmed(monkeypatch):
    monkeypatch.setattr(client.settings,'saspay_billing_currencies','')
    assert client.configured() is False


@pytest.mark.parametrize('url',['http://pay.saspay.me/checkout/a','https://evil.test/checkout/a','https://pay.saspay.me.evil.test/a','https://user:pass@pay.saspay.me/a'])
def test_hosted_checkout_cannot_redirect_to_an_untrusted_origin(url):
    with pytest.raises(HTTPException):client.safe_checkout_url(url)


def test_provider_envelope_is_unwrapped_and_secret_stays_in_server_headers(monkeypatch):
    response=Mock()
    response.json.return_value={'success':True,'data':session(),'code':201}
    request=Mock(return_value=response)
    monkeypatch.setattr(client.httpx,'request',request)
    assert client.request('POST','/checkout-sessions/',{'amount':'49.00'})['id']==SESSION
    assert request.call_args.kwargs['headers']['Authorization']=='Bearer sk_test_fake'
    assert request.call_args.kwargs['follow_redirects'] is False


@pytest.mark.parametrize('path,data', [
    ('/checkout-sessions/', session()),
    (f'/checkout-sessions/{SESSION}/', session()),
    ('/checkout-sessions/?page=1', {'results':[session()], 'next':None}),
    (f'/payments/{PAYMENT}/verify/', payment()),
])
def test_provider_accepts_documented_direct_resource_responses(monkeypatch, path, data):
    response=Mock();response.json.return_value=data
    monkeypatch.setattr(client.httpx,'request',Mock(return_value=response))
    assert client.request('GET' if '?' in path or '/verify/' in path else 'POST',path)==data


@pytest.mark.parametrize('data', [
    {'success':False,'data':session()},
    {'success':True,'data':None},
    {'message':'Something failed'},
    {'data':session()},
    [], None,
])
def test_provider_never_accepts_error_or_malformed_envelopes(monkeypatch, data):
    response=Mock();response.json.return_value=data
    monkeypatch.setattr(client.httpx,'request',Mock(return_value=response))
    with pytest.raises(HTTPException) as error:
        client.request('POST','/checkout-sessions/')
    assert error.value.detail=='saspay_invalid_response'


def test_provider_error_diagnostics_never_log_response_or_credentials(monkeypatch, caplog):
    response=Mock();response.json.return_value={'success':False,'message':'secret-personal-data'}
    monkeypatch.setattr(client.httpx,'request',Mock(return_value=response))
    with pytest.raises(HTTPException):client.request('POST','/checkout-sessions/')
    assert 'SasPay invalid response' in caplog.text
    assert 'secret-personal-data' not in caplog.text
    assert 'sk_test_fake' not in caplog.text


def test_direct_checkout_response_still_undergoes_merchant_and_url_checks(monkeypatch):
    monkeypatch.setattr(repo,'ensure_trial',Mock())
    monkeypatch.setattr(repo,'reserve_checkout',Mock(return_value=(attempt(),True)))
    update=Mock();monkeypatch.setattr(repo,'update_checkout',update)
    response=Mock();response.json.return_value=session()
    monkeypatch.setattr(client.httpx,'request',Mock(return_value=response))
    assert service.start_checkout('agency','STARTER','payer@example.com','Payeur')['checkout_url']==session()['checkout_url']
    assert update.call_args.args==(ATTEMPT,'PENDING')
    update.reset_mock()
    response.json.return_value={**session(),'checkout_url':'https://evil.example/checkout'}
    with pytest.raises(HTTPException):service.start_checkout('agency','STARTER','payer@example.com','Payeur')
    assert update.call_args.args==(ATTEMPT,'UNKNOWN')


@pytest.mark.parametrize('field,value',[('status','PENDING'),('status','FAILED'),('currency','EUR'),('requested_amount','0.49'),('merchant','another'),('flow_direction','OUTBOUND'),('id',SESSION)])
def test_unpaid_or_mismatched_payments_never_activate_subscription(monkeypatch,field,value):
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value=attempt()))
    paid=payment();paid[field]=value
    monkeypatch.setattr(client,'request',Mock(side_effect=[session(),paid]))
    settle,update=Mock(),Mock()
    monkeypatch.setattr(repo,'settle_checkout',settle);monkeypatch.setattr(repo,'update_checkout',update)
    if field=='status':
        assert service.verify_checkout(ATTEMPT,'agency')['status']==value
    else:
        with pytest.raises(HTTPException):service.verify_checkout(ATTEMPT,'agency')
    settle.assert_not_called()


def test_successful_payment_is_bound_to_session_and_preserves_charged_and_net(monkeypatch):
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value=attempt()))
    request=Mock(side_effect=[session(),payment()]);monkeypatch.setattr(client,'request',request)
    settle=Mock();monkeypatch.setattr(repo,'settle_checkout',settle)
    assert service.verify_checkout(ATTEMPT,'agency')['status']=='SUCCESS'
    assert request.call_args_list[1].args[1]==f'/payments/{PAYMENT}/verify/'
    assert settle.call_args.args[2]['debited_amount']=='50.00'
    assert settle.call_args.args[2]['net_amount']=='49.00'


def test_checkout_amount_comes_from_server_catalog_not_client(monkeypatch):
    monkeypatch.setattr(repo,'ensure_trial',Mock())
    monkeypatch.setattr(repo,'reserve_checkout',Mock(return_value=(attempt(),True)))
    monkeypatch.setattr(repo,'update_checkout',Mock())
    request=Mock(return_value=session());monkeypatch.setattr(client,'request',request)
    result=service.start_checkout('agency','STARTER','payer@example.com','Payeur')
    assert result['checkout_url'].startswith('https://pay.saspay.me/')
    assert request.call_args.args[2]['amount']=='49.00'
    assert request.call_args.args[2]['return_url'].endswith(f'&checkout={ATTEMPT}')


def test_repeated_checkout_request_reuses_session_without_a_second_provider_post(monkeypatch):
    monkeypatch.setattr(repo,'ensure_trial',Mock())
    data=attempt();data['checkout_url']='https://pay.saspay.me/checkout/existing'
    monkeypatch.setattr(repo,'reserve_checkout',Mock(return_value=(data,False)))
    request=Mock();monkeypatch.setattr(client,'request',request)
    assert service.start_checkout('agency','STARTER','payer@example.com','Payeur')['id']==ATTEMPT
    request.assert_not_called()


def test_ambiguous_creation_is_never_blindly_retried(monkeypatch):
    monkeypatch.setattr(repo,'ensure_trial',Mock())
    monkeypatch.setattr(repo,'reserve_checkout',Mock(return_value=(attempt(),True)))
    monkeypatch.setattr(client,'request',Mock(side_effect=HTTPException(502,'saspay_unavailable')))
    update=Mock();monkeypatch.setattr(repo,'update_checkout',update)
    with pytest.raises(HTTPException):service.start_checkout('agency','STARTER','payer@example.com','Payeur')
    update.assert_called_once_with(ATTEMPT,'UNKNOWN')


def test_lost_checkout_response_is_recovered_with_get_requests_only(monkeypatch):
    data=attempt();data.update(status='UNKNOWN',provider_session_id=None)
    remote=session();remote['description']=f'Abonnement SLAIVIO / {ATTEMPT}'
    request=Mock(return_value={'results':[remote],'next':None});monkeypatch.setattr(client,'request',request)
    update=Mock();monkeypatch.setattr(repo,'update_checkout',update)
    recovered=service.recover_session(data)
    assert recovered['provider_session_id']==SESSION
    assert request.call_args.args==('GET','/checkout-sessions/?page=1')
    assert update.call_args.args==(ATTEMPT,'PENDING')


@pytest.mark.parametrize('url',['https://checkout.saspay.me/abc','https://pay.saspay.me/checkout/abc'])
def test_both_exact_saspay_checkout_origins_are_accepted(url):
    assert client.safe_checkout_url(url)==url


@pytest.mark.parametrize('url',['http://checkout.saspay.me/abc','https://checkout.saspay.me.evil.test/a','https://evil@checkout.saspay.me/a','https://checkout.saspay.me:444/a'])
def test_new_checkout_origin_does_not_weaken_redirect_validation(url):
    with pytest.raises(HTTPException):client.safe_checkout_url(url)


def test_cancel_verifies_provider_cancellation_before_releasing_reservation(monkeypatch):
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value=attempt()))
    remote={**session(),'status':'PENDING','transaction':None}
    cancelled={**remote,'status':'CANCELLED'}
    request=Mock(side_effect=[remote,cancelled,cancelled]);monkeypatch.setattr(client,'request',request)
    close=Mock();monkeypatch.setattr(repo,'close_cancelled_checkout',close)
    assert service.cancel_checkout(ATTEMPT,'agency')['status']=='CANCELLED'
    assert request.call_args_list[1].args==('POST',f'/checkout-sessions/{SESSION}/cancel/',{})
    close.assert_called_once_with(ATTEMPT)


def test_cancel_never_releases_a_checkout_with_a_processing_payment(monkeypatch):
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value=attempt()))
    monkeypatch.setattr(repo,'update_checkout',Mock())
    remote={**session(),'status':'PENDING'}
    request=Mock(side_effect=[remote,{**payment(),'status':'PENDING'}]);monkeypatch.setattr(client,'request',request)
    close=Mock();monkeypatch.setattr(repo,'close_cancelled_checkout',close)
    with pytest.raises(HTTPException) as error:service.cancel_checkout(ATTEMPT,'agency')
    assert error.value.detail=='billing_payment_processing'
    assert all(call.args[0]=='GET' for call in request.call_args_list)
    close.assert_not_called()


def test_cancel_never_voids_an_already_paid_checkout(monkeypatch):
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value={**attempt(),'status':'SUCCESS'}))
    request,close=Mock(),Mock()
    monkeypatch.setattr(client,'request',request);monkeypatch.setattr(repo,'close_cancelled_checkout',close)
    with pytest.raises(HTTPException) as error:service.cancel_checkout(ATTEMPT,'agency')
    assert error.value.detail=='billing_checkout_already_paid'
    request.assert_not_called();close.assert_not_called()


def test_old_price_is_cancelled_before_creating_checkout_at_current_server_price(monkeypatch):
    monkeypatch.setattr(repo,'ensure_trial',Mock())
    old={**attempt(),'plan_code':'STARTER'}
    new={**attempt(),'id':'44444444-4444-4444-8444-444444444444','amount_minor':11900}
    monkeypatch.setattr(repo,'reserve_checkout',Mock(side_effect=[(old,False),(new,True)]))
    monkeypatch.setattr(service,'get_pricing_plan',Mock(return_value={'monthly_price_minor':11900,'currency_code':'USD'}))
    cancel=Mock();monkeypatch.setattr(service,'cancel_checkout',cancel)
    monkeypatch.setattr(repo,'update_checkout',Mock())
    request=Mock(return_value={**session(),'amount':'119.00','checkout_url':'https://checkout.saspay.me/new'})
    monkeypatch.setattr(client,'request',request)
    assert service.start_checkout('agency','STARTER','payer@example.com','Payeur')['id']==new['id']
    cancel.assert_called_once_with(ATTEMPT,'agency')
    assert request.call_args.args[2]['amount']=='119.00'


def test_a_different_selected_plan_never_reuses_the_previous_plan_checkout(monkeypatch):
    monkeypatch.setattr(repo,'ensure_trial',Mock())
    monkeypatch.setattr(repo,'reserve_checkout',Mock(return_value=({**attempt(),'plan_code':'STARTER'},False)))
    cancel=Mock(side_effect=HTTPException(409,'billing_payment_processing'))
    monkeypatch.setattr(service,'cancel_checkout',cancel)
    request=Mock();monkeypatch.setattr(client,'request',request)
    with pytest.raises(HTTPException):service.start_checkout('agency','PRO','payer@example.com','Payeur')
    cancel.assert_called_once_with(ATTEMPT,'agency');request.assert_not_called()


def test_failed_cancellation_does_not_create_a_new_payment(monkeypatch):
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value=attempt()))
    remote={**session(),'status':'PENDING','transaction':None}
    request=Mock(side_effect=[remote,remote,remote]);monkeypatch.setattr(client,'request',request)
    close=Mock();monkeypatch.setattr(repo,'close_cancelled_checkout',close)
    with pytest.raises(HTTPException) as error:service.cancel_checkout(ATTEMPT,'agency')
    assert error.value.detail=='billing_checkout_cancellation_unconfirmed'
    close.assert_not_called()


def test_webhook_never_trusts_the_success_status_without_provider_verification(monkeypatch):
    request=Mock(side_effect=[payment(),session()]);monkeypatch.setattr(client,'request',request)
    monkeypatch.setattr(repo,'get_checkout',Mock(return_value=attempt()))
    settle=Mock();monkeypatch.setattr(repo,'settle_checkout',settle)
    service.process_webhook({'event':'transaction.success','data':{'id':PAYMENT,'amount':'0.01'}})
    assert request.call_count==2
    settle.assert_called_once()


def test_cross_tenant_checkout_is_checked_before_any_provider_request(monkeypatch):
    monkeypatch.setattr(repo,'get_checkout',Mock(side_effect=HTTPException(404,'billing_checkout_not_found')))
    request=Mock();monkeypatch.setattr(client,'request',request)
    with pytest.raises(HTTPException):service.verify_checkout(ATTEMPT,'another-agency')
    request.assert_not_called()


def test_trial_creation_uses_insert_do_nothing_never_resets_dates(monkeypatch):
    conn,engine=MagicMock(),MagicMock();engine.begin.return_value.__enter__.return_value=conn
    monkeypatch.setattr(repo,'engine',engine);monkeypatch.setattr(repo,'account_id',lambda *args:'agency')
    conn.execute.return_value.mappings.return_value.first.return_value={'status':'ACTIVE','ends_at':'2028-01-01'}
    assert repo.ensure_trial('office')['status']=='ACTIVE'
    query=str(conn.execute.call_args_list[0].args[0]).lower()
    assert "interval '30 days'" in query and 'on conflict(org_id) do nothing' in query
    assert 'do update' not in query


def test_duplicate_settlement_does_not_extend_access_twice(monkeypatch):
    state=attempt();state['status']='PENDING'
    invoice={'id':'invoice','org_id':'agency','subscription_id':'subscription','status':'OPEN','total_minor':4900,'currency_code':'USD'}
    conn,engine=MagicMock(),MagicMock();engine.begin.return_value.__enter__.return_value=conn
    calls=[]
    def execute(sql,params):
        query=str(sql);calls.append(query)
        result=MagicMock()
        if query.startswith('select * from billing_checkout_sessions'):result.mappings.return_value.one.return_value=dict(state)
        if query.startswith('select * from billing_invoices'):result.mappings.return_value.one.return_value=invoice
        if "update billing_checkout_sessions set status='SUCCESS'" in query:state['status']='SUCCESS'
        return result
    conn.execute.side_effect=execute;monkeypatch.setattr(repo,'engine',engine)
    repo.settle_checkout(ATTEMPT,PAYMENT,{});repo.settle_checkout(ATTEMPT,PAYMENT,{})
    assert sum('insert into billing_payments' in query for query in calls)==1
    assert sum('update agency_subscriptions' in query for query in calls)==1
    assert 'for update' in calls[0]


def test_expired_subscription_blocks_operations_but_allows_renewal(monkeypatch):
    past=datetime.now(timezone.utc)-timedelta(days=1)
    active={'org_id':'agency','role_code':'OWNER','subscription_status':'TRIAL','subscription_trial_ends_at':past}
    monkeypatch.setattr(tenant_context,'get_tenant_context',lambda _: {'active_tenant':active})
    def request(path):return Request({'type':'http','path':path,'headers':[],'scheme':'https','server':('test',443),'query_string':b''})
    with pytest.raises(HTTPException) as error:tenant_context.get_current_tenant({'user_id':'owner'},request('/packages'))
    assert error.value.status_code==402
    assert tenant_context.get_current_tenant({'user_id':'owner'},request('/billing'))['org_id']=='agency'


def test_manual_payment_confirmation_is_not_exposed_to_agency_users():
    route=next(route for route in billing.router.routes if route.path=='/billing/payments/confirm')
    assert any('platform.billing.manage' in [cell.cell_contents for cell in (getattr(dep.call,'__closure__',None) or ())] for dep in route.dependant.dependencies)


def test_invalid_webhook_signature_is_rejected_before_processing(monkeypatch):
    request=Mock(headers={'X-Webhook-Signature':'bad','X-Webhook-Timestamp':'0'})
    request.body=AsyncMock(return_value=json.dumps({'event':'transaction.success','data':{'id':PAYMENT}}).encode())
    process=Mock();monkeypatch.setattr(service,'process_webhook',process)
    with pytest.raises(HTTPException):asyncio.run(billing.saspay_webhook(request))
    process.assert_not_called()
