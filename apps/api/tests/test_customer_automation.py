"""No provider calls, no production DB: exercise policies and transactional commands."""
from datetime import datetime,timezone
from decimal import Decimal
from hashlib import sha256
from unittest.mock import MagicMock
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.customer_automation import repository as repo
from app.customer_automation.policy import CustomerAutomation,TEMPLATES,message
from app.finance import repository as finance
from app.pickups import repository as pickups
from app.api import customer_automation as api
from app.documents.agency_brand import invoice_html

UTC=timezone.utc


def setup_engine(monkeypatch,module=repo):
 conn,engine=MagicMock(),MagicMock()
 engine.begin.return_value.__enter__.return_value=conn
 engine.connect.return_value.__enter__.return_value=conn
 monkeypatch.setattr(module,'engine',engine)
 return conn,engine


def ctx(**policy):
 return {'phone':'+243812345678','client':'Marie','agency':'Agence Cargo','timezone':'Africa/Kinshasa',
         'policy':CustomerAutomation(**policy).model_dump()}


@pytest.mark.parametrize('template',['{client.__class__}','{client[secret]}','{client!r}','{amount:1000000}','{unknown}','{'])
def test_message_templates_reject_expression_or_unknown_variable(template):
 with pytest.raises(ValidationError):CustomerAutomation(messages={'awaiting_parcel':template})


@pytest.mark.parametrize('values',[{'awaiting_delay_days':0},{'max_reminders':100},{'payment_enabled':'false'},{'pickup_delay_days':1.2}])
def test_policy_rejects_invalid_schedule_and_non_boolean_flags(values):
 with pytest.raises(ValidationError):CustomerAutomation(**values)


def test_templates_preserve_essential_payment_and_invoice_information():
 CustomerAutomation(messages=TEMPLATES)
 for key in ('payment_confirmed','documents_ready'):
  with pytest.raises(ValidationError):CustomerAutomation(messages={key:'Merci pour votre confiance.'})


def test_custom_message_uses_values_as_data_and_agency_identity():
 output=message({'messages':{'awaiting_parcel':'Bonjour {client}, contactez {agency}.'}},'awaiting_parcel',{'client':'{amount.__class__}','agency':'Agence Cargo'})
 assert output=='Agence Cargo\n\nBonjour {amount.__class__}, contactez Agence Cargo.'


@pytest.mark.parametrize('now,expected',[(datetime(2026,10,3,tzinfo=UTC),0),(datetime(2026,10,4,tzinfo=UTC),0),(datetime(2026,10,7,tzinfo=UTC),3)])
def test_storage_counts_destination_days_after_full_grace_period(now,expected):
 assert repo.storage_days(datetime(2026,10,1,tzinfo=UTC),now,3)==expected


def test_storage_uses_agency_calendar_not_utc_dates():
 ready=datetime(2026,10,1,23,30,tzinfo=UTC)
 now=datetime(2026,10,2,0,30,tzinfo=UTC)
 assert repo.storage_days(ready,now,0,'Africa/Kinshasa')==0
 assert repo.storage_days(ready,now,0,'UTC')==1


def account(**overrides):
 return {'ready_at':datetime(2026,10,1,tzinfo=UTC),'grace_days':3,'daily_rate':Decimal('0.10'),
         'currency':'USD','package_currency':'USD','timezone':'UTC','billed_days':0,'client_id':'client',
         'package_reference':'COL-001',**overrides}


def test_storage_creates_exact_separate_invoice_and_advances_ledger(monkeypatch):
 c=MagicMock();c.execute.return_value.mappings.return_value.first.return_value=account()
 create=MagicMock(return_value={'id':'invoice'});monkeypatch.setattr(finance,'create_in_transaction',create)
 monkeypatch.setattr(finance,'event',MagicMock())
 amount=repo.accrue_storage(c,'agency','parcel',datetime(2026,10,7,tzinfo=UTC))
 assert amount==Decimal('0.30')
 payload=create.call_args.args[-1]
 assert payload['lines'][0]['quantity']==3
 assert payload['lines'][0]['unit_price']==Decimal('0.10')
 assert 'package_id' not in payload  # Never replace the transport invoice.
 assert c.execute.call_args.args[1]['days']==3
 assert 'for update of a' in str(c.execute.call_args_list[0].args[0])


@pytest.mark.parametrize('values',[{'daily_rate':0},{'billed_days':3}])
def test_same_storage_days_or_zero_rate_are_never_billed_again(values,monkeypatch):
 c=MagicMock();c.execute.return_value.mappings.return_value.first.return_value=account(**values)
 create=MagicMock();monkeypatch.setattr(finance,'create_in_transaction',create)
 assert repo.accrue_storage(c,'agency','parcel',datetime(2026,10,7,tzinfo=UTC))==0
 create.assert_not_called()


def test_storage_does_not_mix_currencies(monkeypatch):
 c=MagicMock();c.execute.return_value.mappings.return_value.first.return_value=account(currency='XAF')
 create=MagicMock();monkeypatch.setattr(finance,'create_in_transaction',create)
 with pytest.raises(ValueError,match='storage_currency_mismatch'):
  repo.accrue_storage(c,'agency','parcel',datetime(2026,10,7,tzinfo=UTC))
 create.assert_not_called()


def test_unpaid_storage_blocks_release_even_with_a_manually_marked_pickup(monkeypatch):
 monkeypatch.setattr(repo,'accrue_storage',MagicMock())
 monkeypatch.setattr(repo,'storage_totals',lambda *_:{'total':'10','paid':'4','balance':'6'})
 with pytest.raises(HTTPException) as exc:repo.check_release(MagicMock(),'agency',['parcel'])
 assert exc.value.status_code==409
 assert exc.value.detail['code']=='storage_payment_required'
 assert repo.check_release(MagicMock(),'agency',['parcel'],False)['balance']=='6'


@pytest.mark.parametrize('status,expected',[('CONFIRMED',True),('REVERSED',False)])
def test_payment_notification_only_comes_from_confirmed_payment(status,expected,monkeypatch):
 c=MagicMock();c.execute.return_value.mappings.return_value.first.return_value={'status':status,'client_id':'client'}
 monkeypatch.setattr(repo,'context',lambda *_:ctx());queued=MagicMock();monkeypatch.setattr(repo,'queue',queued)
 repo._payment(c,{'org_id':'agency','entity_id':'payment','event_key':'payment:1','payload':{'balance':'60','amount':'40','currency':'USD','receipt':'REC-1','document_number':'FAC-1'}})
 assert queued.called is expected
 if expected:
  values=queued.call_args.args[-2]
  assert values['amount']=='40.00'
  assert '60.00 USD' in values['payment_summary']


def test_fully_paid_message_does_not_claim_an_outstanding_balance(monkeypatch):
 c=MagicMock();c.execute.return_value.mappings.return_value.first.return_value={'status':'CONFIRMED','client_id':'client'}
 monkeypatch.setattr(repo,'context',lambda *_:ctx());queued=MagicMock();monkeypatch.setattr(repo,'queue',queued)
 repo._payment(c,{'org_id':'agency','entity_id':'payment','event_key':'payment:1','payload':{'balance':'0','amount':'40','currency':'USD'}})
 assert queued.call_args.args[-2]['payment_summary']=='La facture est entièrement réglée.'


@pytest.mark.parametrize('marketing,opt_in,allowed',[(False,False,True),(True,False,False),(True,True,True)])
def test_announcements_require_explicit_opt_in(marketing,opt_in,allowed):
 c=MagicMock();c.execute.return_value.first.side_effect=[None,(1,) if opt_in else None]
 assert repo.permitted(c,'agency','+243812345678',marketing=marketing) is allowed


def test_opt_out_blocks_even_operational_reminder():
 c=MagicMock();c.execute.return_value.first.return_value=(1,)
 assert repo.permitted(c,'agency','+243812345678') is False


@pytest.mark.parametrize('kind,status',[('pickup_reminder','DELIVERED'),('storage_due','CANCELLED'),('departure_blocked','SHIPPED')])
def test_stale_reminder_is_cancelled_before_provider_send(kind,status,monkeypatch):
 c,_=setup_engine(monkeypatch)
 c.execute.return_value.mappings.return_value.first.return_value={'status':status}
 monkeypatch.setattr(repo,'context',lambda *_:ctx());monkeypatch.setattr(repo,'permitted',lambda *_args,**_kwargs:True)
 assert repo.can_dispatch({'org_id':'agency','client_id':'client','recipient_phone':'+243812345678','notification_type':f'CUSTOMER:{kind}:parcel:key'}) is False


def test_receiving_the_expected_parcel_cancels_queued_waiting_reminder(monkeypatch):
 c,_=setup_engine(monkeypatch);c.execute.return_value.first.return_value=None
 monkeypatch.setattr(repo,'context',lambda *_:ctx());monkeypatch.setattr(repo,'permitted',lambda *_args,**_kwargs:True)
 assert not repo.can_dispatch({'org_id':'agency','client_id':'client','recipient_phone':'+243812345678','notification_type':'CUSTOMER:awaiting_parcel:expectation:key'})
 assert "status='WAITING'" in str(c.execute.call_args.args[0])


def test_failed_events_keep_bounded_retry_and_error_visible(monkeypatch):
 c,_=setup_engine(monkeypatch)
 c.execute.return_value.mappings.return_value.first.return_value={'id':'event','org_id':'agency','kind':'documents_ready','entity_id':'pickup','payload':{}}
 monkeypatch.setattr(repo,'_documents',MagicMock(side_effect=ValueError('customer_invoice_required')))
 assert repo.process_events(1)=={'done':0,'failed':1}
 sql,params=c.execute.call_args.args
 assert 'attempts>=4' in str(sql) and "'FAILED'" in str(sql)
 assert params['error']=='customer_invoice_required'
 c.begin_nested.assert_called_once()


def test_public_document_requires_full_unpredictable_token(monkeypatch):
 engine=MagicMock();monkeypatch.setattr(api,'engine',engine)
 with pytest.raises(HTTPException):api.public_document('FAC-1')
 engine.connect.assert_not_called()


def test_public_document_uses_hash_expiry_revocation_and_no_cache(monkeypatch):
 c,_=setup_engine(monkeypatch,api)
 c.execute.return_value.first.return_value=('<html>Facture</html>',)
 token='a'*48;response=api.public_document(token)
 sql,params=c.execute.call_args.args
 assert params['hash']==sha256(token.encode()).hexdigest()
 assert 'revoked_at is null' in str(sql) and 'expires_at>now()' in str(sql)
 assert "d.status<>'VOID'" in str(sql)
 assert response.headers['cache-control']=='private, no-store'
 assert response.headers['referrer-policy']=='no-referrer'


def test_bad_pickup_code_attempt_is_committed_before_http_error(monkeypatch):
 c,engine=setup_engine(monkeypatch,pickups)
 monkeypatch.setattr(pickups,'settings_for',lambda _:{'max_otp_attempts':3})
 c.execute.return_value.mappings.return_value.first.return_value={'id':'otp','attempts':2,'code_hash':'wrong','expires_at':datetime(2099,1,1,tzinfo=UTC)}
 monkeypatch.setattr(pickups,'_hash',lambda *_:'expected')
 with pytest.raises(HTTPException) as exc:pickups.verify_otp('agency','pickup','operator','Agent','123456')
 assert exc.value.detail=='pickup_otp_invalid'
 assert c.execute.call_args.args[1]['s']=='LOCKED'
 assert c.execute.call_args.args[1]['a']==3
 assert engine.begin.return_value.__exit__.call_args.args[0] is None


def test_invoice_layout_is_customizable_without_unescaped_html():
 document={'document_type':'INVOICE','document_number':'FAC-1','lines':[],'client_name':'Marie <script>bad</script>','client_phone':'SECRET_PHONE','client_email':'SECRET_MAIL'}
 html=invoice_html(document,{}, {'invoice_preferences':{'invoice_title':'Facture <b>agence</b>','invoice_footer':'<script>bad</script>','invoice_layout':'COMPACT','invoice_accent_color':'#16855f','show_client_phone':False,'show_client_email':False,'show_due_date':False}})
 assert '<script>' not in html and 'SECRET_PHONE' not in html and 'SECRET_MAIL' not in html
 assert 'Facture &lt;b&gt;agence&lt;/b&gt;' in html and 'padding:7px' in html and '#16855f' in html
 assert 'Échéance' not in html


def test_migration_records_events_in_business_transaction_without_retroactive_billing():
 source=(Path(__file__).resolve().parents[3]/'infra/sql/157_customer_journey_automation.sql').read_text(encoding='utf-8')
 for table in ('finance_payments','pickup_orders','cargo_packages','parcel_customer_journeys'):
  assert f'after insert or update on {table}' in source
 assert 'unique(org_id,event_key)' in source and 'enable row level security' in source
 assert 'No retroactive storage billing' in source
 assert 'e.created_at,e.id limit 1 for update of e' in source
 assert 'expectation_id uuid not null unique references package_expectations(id)' in source


def test_direct_delivery_saves_a_frozen_invoice_and_queues_an_opaque_link(monkeypatch):
 from app.documents import agency_brand
 c=MagicMock()
 order,documents,financial,lines,share=[MagicMock() for _ in range(5)]
 order.mappings.return_value.first.return_value={'client_id':'client'}
 documents.mappings.return_value.all.return_value=[{'id':'invoice','document_type':'INVOICE','document_number':'FAC-1','currency':'USD','total':'20','balance_due':'0'}]
 financial.mappings.return_value.first.return_value={}
 lines.mappings.return_value.__iter__.return_value=iter([{'description':'Transport','quantity':1,'unit_price':20,'line_total':20}])
 share.first.return_value=('share',)
 c.execute.side_effect=[order,documents,financial,lines,share]
 monkeypatch.setattr(repo,'context',lambda *_:ctx())
 monkeypatch.setattr(agency_brand,'identity',lambda *_:{'organization_name':'Agence Cargo','invoice_preferences':{'invoice_footer':'Version originale'}})
 monkeypatch.setattr(repo.secrets,'token_urlsafe',lambda _:'a'*48)
 queued=MagicMock();monkeypatch.setattr(repo,'queue',queued)
 repo._documents(c,{'kind':'package_documents_ready','org_id':'agency','entity_id':'parcel','event_key':'package-delivery:parcel'})
 sql,payload=c.execute.call_args.args
 assert payload['package']=='parcel' and payload['p'] is None
 assert payload['hash']==sha256(('a'*48).encode()).hexdigest()
 assert 'Version originale' in payload['html'] and 'FAC-1' in payload['html']
 assert 'html_snapshot' in str(sql) and 'on conflict do nothing' in str(sql)
 assert queued.call_args.args[-2]['document_url'].endswith('/customer-documents/'+'a'*48)


def test_pausing_waiting_reminders_does_not_consume_the_delivery_limit(monkeypatch):
 c,_=setup_engine(monkeypatch)
 c.execute.return_value.mappings.return_value.all.return_value=[{'id':'expectation','org_id':'agency','client_id':'client','reminder_count':0}]
 monkeypatch.setattr(repo,'context',lambda *_:ctx(awaiting_enabled=False))
 queued=MagicMock();monkeypatch.setattr(repo,'queue',queued)
 assert repo.process_expectations()==0
 queued.assert_not_called()
 assert c.execute.call_args.args[1]['increment']==0


def test_existing_daily_reminder_prevents_another_operational_message(monkeypatch):
 c=MagicMock();c.execute.return_value.first.return_value=(1,)
 monkeypatch.setattr(repo,'permitted',lambda *_args,**_kwargs:True)
 assert repo.queue(c,'agency','client','awaiting_parcel','expectation','key',{},ctx()) is None
 assert not any('insert into notification_outbox' in str(call.args[0]) for call in c.execute.call_args_list)


def test_phone_change_does_not_send_queued_financial_data_to_the_old_number(monkeypatch):
 setup_engine(monkeypatch)
 monkeypatch.setattr(repo,'context',lambda *_:ctx())
 monkeypatch.setattr(repo,'permitted',lambda *_args,**_kwargs:True)
 assert not repo.can_dispatch({'org_id':'agency','client_id':'client','recipient_phone':'+243899999999','notification_type':'CUSTOMER:payment_confirmed:payment:key'})


def test_due_storage_invoice_is_committed_before_release_is_rejected(monkeypatch):
 c,engine=setup_engine(monkeypatch)
 c.execute.return_value.mappings.return_value.all.return_value=[{'id':'parcel','org_id':'agency'}]
 accrue=MagicMock();monkeypatch.setattr(repo,'accrue_storage',accrue)
 repo.prepare_storage('agency',['parcel'])
 accrue.assert_called_once_with(c,'agency','parcel')
 assert engine.begin.return_value.__exit__.call_args.args[0] is None
 monkeypatch.setattr(repo,'storage_totals',lambda *_:{'balance':'5','total':'5','paid':'0'})
 with pytest.raises(HTTPException):repo.check_release(c,'agency',['parcel'])
 assert accrue.call_count==1  # The rejected operation cannot roll back invoicing.


def test_many_storage_invoices_form_one_printable_document_bundle():
 def invoice(number):return invoice_html({'document_type':'INVOICE','document_number':number,'lines':[],'currency':'USD'},{},{})
 html=repo.document_bundle([invoice('FAC-1'),invoice('FAC-2')])
 assert html.count('<!doctype html>')==1
 assert 'FAC-1' in html and 'FAC-2' in html
 assert html.count('onclick="window.print()"')==1
 assert 'break-after:page' in html


def test_partial_storage_payment_cancels_a_reminder_with_an_outdated_balance(monkeypatch):
 c,_=setup_engine(monkeypatch)
 c.execute.return_value.mappings.return_value.first.return_value={'status':'READY_FOR_PICKUP','package_reference':'COL-1','currency':'USD'}
 monkeypatch.setattr(repo,'context',lambda *_:ctx())
 monkeypatch.setattr(repo,'permitted',lambda *_args,**_kwargs:True)
 monkeypatch.setattr(repo,'storage_totals',lambda *_:{'total':'10','balance':'4'})
 notification={'org_id':'agency','client_id':'client','recipient_phone':ctx()['phone'],
  'notification_type':'CUSTOMER:storage_due:parcel:key','message':message(ctx()['policy'],'storage_due',
   {**ctx(),'tracking':'COL-1','storage_fee':'10.00','storage_balance':'10.00','currency':'USD','conditions':''})}
 assert repo.can_dispatch(notification) is False
