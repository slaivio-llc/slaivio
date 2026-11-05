import json
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import MagicMock
import pytest
from app.ai.repositories import customer_profile as profiles
from app.ai.repositories import parcel_customer_journey_repository as journeys
from app.ai.services import pilot_inbox_ai_service as ai
from app.db import followup_repository as followups

PHONE='+243812345678'


def test_lookup_scoped_to_unique_active_customer_and_trusted_phone():
    c=MagicMock()
    c.execute.return_value.mappings.return_value.all.return_value=[{'full_name':'Akiemane','client_id':'client','customer_type':'individual'}]
    assert profiles.known_profile('agency',PHONE,connection=c)['full_name']=='Akiemane'
    sql,params=c.execute.call_args.args
    assert 'org_id=:org' in str(sql) and 'deleted_at is null' in str(sql) and 'limit 2' in str(sql)
    assert params=={'org':'agency','phone':PHONE,'digits':'243812345678'}


@pytest.mark.parametrize('matches',[[],[{'full_name':'A'},{'full_name':'B'}]])
def test_ambiguous_or_unknown_phone_never_exposes_profile(matches):
    c=MagicMock();c.execute.return_value.mappings.return_value.all.return_value=matches
    assert profiles.known_profile('agency',PHONE,connection=c)=={}


@pytest.mark.parametrize('phone',['123@g.us','123@lid','123','https://evil'])
def test_no_profile_lookup_for_untrusted_channel_identity(phone):
    c=MagicMock()
    assert profiles.known_profile('agency',phone,connection=c)=={}
    c.execute.assert_not_called()


@pytest.mark.parametrize('name',['Client','Client WhatsApp','Client +243812345678','+243812345678'])
def test_placeholder_is_not_treated_as_known_identity(name):
    assert not profiles.clean_profile({'full_name':name}).get('full_name')


def test_explicit_correction_wins_without_erasing_other_known_data():
    result=profiles.merge_profile({'city':'Kinshasa','full_name':None},{'country':'Congo'},
        {'full_name':'Akiemane','city':'Matadi','customer_type':'individual'})
    assert result=={'full_name':'Akiemane','city':'Kinshasa','country':'Congo','customer_type':'individual'}


def test_prior_explicit_correction_is_not_replaced_by_older_crm_value():
    assert profiles.merge_profile({}, {'city':'Kinshasa'}, {'city':'Matadi'})['city']=='Kinshasa'


def test_known_real_name_replaces_journey_placeholder():
    assert profiles.merge_profile({}, {'full_name':'Client WhatsApp'}, {'full_name':'Akiemane'})['full_name']=='Akiemane'


def test_invalid_model_values_and_whitespace_do_not_replace_known_profile():
    merged=profiles.merge_profile({'full_name':{},'customer_type':True,'city':'   '},{},
        {'full_name':'Akiemane','customer_type':'individual','city':'Kinshasa'})
    assert merged['full_name']=='Akiemane' and merged['city']=='Kinshasa' and merged['customer_type']=='individual'


def test_qualification_reuses_profile_and_previous_conversation(monkeypatch):
    monkeypatch.setattr(ai,'is_parcel_organization',lambda *_:True)
    provider=MagicMock(return_value={'success':True,'content':json.dumps({
        'stage':'QUALIFIED','service_intent_confirmed':True,'confidence':.95,
        'full_name':None,'country':None,'city':None,'customer_type':None})})
    monkeypatch.setattr(ai,'_provider_response',provider)
    def save(org,phone,values,**kwargs):return {**values,'missing_fields':journeys._missing(values)}
    monkeypatch.setattr(ai,'upsert_journey',save)
    result=ai._parcel_qualification({}, {'org_id':'agency',
        'customer_profile':{'full_name':'Akiemane','customer_type':'individual','city':'Kinshasa','client_id':'private-client-id','balance_due':999},
        'customer_journey':{'country':'Congo'}},PHONE)
    assert result['journey']['missing_fields']==[]
    assert 'Quel est votre nom' not in result['reply']
    assert 'Akiemane' in provider.call_args.args[2]
    assert 'Kinshasa' in provider.call_args.args[2]
    assert result['journey']['country']=='Congo'
    assert 'private-client-id' not in provider.call_args.args[2] and '999' not in provider.call_args.args[2]


def test_silence_never_triggers_customer_followup():
    c=MagicMock()
    assert followups._condition_still_true(c,{'followup_type':'CONVERSATION_ABANDONED'}) is False
    c.execute.assert_not_called()
    source=Path(followups.__file__).read_text(encoding='utf-8')
    assert "m.created_at<now()-interval '30 minutes'" not in source


@pytest.mark.parametrize('kind',['CLIENT_INACTIVE','DOCUMENT_MISSING','PACKAGE_DROP_REMINDER','PAYMENT_DUE','QUOTE_FOLLOWUP'])
def test_auto_copy_contains_no_internal_reason_or_identifier(kind):
    text=followups.customer_followup_message(kind,'Akiemane','Mon agence')
    assert 'Akiemane' in text and 'Mon agence' in text
    assert kind not in text and 'sans reprise agent' not in text


def prospect(monkeypatch,stage='QUALIFYING',known=None):
    c=MagicMock()
    c.execute.return_value.mappings.return_value.first.return_value={
        'stage':stage,'conversation_phone':PHONE,'full_name':None,'customer_type':None}
    monkeypatch.setattr(profiles,'known_profile',lambda *args,**kwargs:known or {})
    return c,{'org_id':'agency','journey_id':'journey','followup_type':'PARCEL_PROSPECT'}


def test_profile_completed_after_queue_cancels_stale_question(monkeypatch):
    c,item=prospect(monkeypatch,known={'full_name':'Akiemane','customer_type':'individual'})
    assert followups._prospect_reminder(c,item) is None


def test_only_truly_missing_field_is_requested(monkeypatch):
    c,item=prospect(monkeypatch,known={'full_name':'Akiemane'})
    text=followups._prospect_reminder(c,item)
    assert 'nom complet' not in text and 'particulier' in text
    assert 'pays' not in text and 'ville' not in text


@pytest.mark.parametrize('stage',['CONVERTED','CLOSED','HUMAN_REVIEW','NOT_INTERESTED','QUALIFIED'])
def test_closed_converted_or_human_handled_prospect_is_not_chased(monkeypatch,stage):
    c,item=prospect(monkeypatch,stage=stage)
    assert followups._prospect_reminder(c,item) is None


def test_new_customer_message_invalidates_old_queued_reminder(monkeypatch):
    c,item=prospect(monkeypatch)
    item['queued_at']=datetime.now(timezone.utc)-timedelta(hours=1)
    c.execute.return_value.mappings.return_value.first.return_value['last_inbound_at']=datetime.now(timezone.utc)
    assert followups._prospect_reminder(c,item) is None


def test_interested_customer_gets_no_identity_request(monkeypatch):
    c,item=prospect(monkeypatch,stage='INTERESTED',known={'full_name':'Akiemane','customer_type':'individual'})
    assert 'nom complet' not in followups._prospect_reminder(c,item)


def test_upsert_recomputes_missing_from_crm_not_last_model_output(monkeypatch):
    monkeypatch.setattr(journeys,'get_journey',lambda *args:{})
    monkeypatch.setattr(journeys,'known_profile',lambda *args:{'client_id':'client','full_name':'Akiemane','customer_type':'individual'})
    c=MagicMock();engine=MagicMock();engine.begin.return_value.__enter__.return_value=c
    monkeypatch.setattr(journeys,'engine',engine)
    settings=MagicMock();settings.mappings.return_value.one.return_value={'incomplete_profile_followup_hours':24,'prospect_followup_delay_hours':48}
    saved=MagicMock();saved.mappings.return_value.one.return_value={'id':'journey','stage':'QUALIFYING'}
    c.execute.side_effect=[settings,saved,MagicMock(),MagicMock(),MagicMock()]
    journeys.upsert_journey('agency',PHONE,{'stage':'QUALIFYING'})
    params=c.execute.call_args_list[1].args[1]
    assert params['missing_fields']==[] and params['schedule'] is False
    assert params['client_id']=='client' and params['full_name']=='Akiemane'


def test_sender_uses_refreshed_profile_question(monkeypatch):
    from app.services import notification_sender as sender
    n={'id':'n','org_id':'agency','channel':'whatsapp','recipient_phone':PHONE,
       'message':'Quel est votre nom complet ?','notification_type':'FOLLOWUP:PARCEL_PROSPECT'}
    monkeypatch.setattr(sender,'claim_notification_dispatch',lambda *args:n)
    monkeypatch.setattr(sender,'validate_followup_notification',lambda *args:{'allowed':True,'message':'Êtes-vous un particulier ?'})
    for attr in ('mark_notification_sent','finish_notification_dispatch','_project_result'):monkeypatch.setattr(sender,attr,MagicMock())
    provider=MagicMock();provider.send_message.return_value={'success':True}
    monkeypatch.setattr(sender,'get_whatsapp_provider',lambda **kwargs:provider)
    assert sender.send_notification('agency','n')['status']=='sent'
    assert provider.send_message.call_args.kwargs['message']=='Êtes-vous un particulier ?'


def test_migration_never_resets_ambiguous_sends_or_deletes_history():
    sql=(Path(__file__).parents[3]/'infra/sql/172_stop_generic_conversation_followups.sql').read_text(encoding='utf-8')
    assert "n.status='PENDING' and n.dispatch_state='IDLE'" in sql
    assert "n.dispatch_state in ('UNKNOWN','CLAIMED','ACCEPTED')" in sql
    assert "like 'auto:CONVERSATION_ABANDONED:%'" in sql
    assert 'delete from' not in sql.lower() and "set dispatch_state='IDLE'" not in sql
