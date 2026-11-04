from datetime import datetime, timezone
from unittest.mock import MagicMock
import json
import pytest
from fastapi import HTTPException, BackgroundTasks
from app.finance import invoice_whatsapp as invoices
from app.finance.invoice_pdf import render, filename
from app.services import notification_sender as sender


def result(row=None, scalar=None):
    mock=MagicMock()
    mock.mappings.return_value.first.return_value=row
    mock.scalar.return_value=scalar
    return mock


@pytest.fixture
def doc():
    return {'id':'doc','org_id':'agency','document_type':'INVOICE','status':'ISSUED',
        'client_id':'client','document_number':'FAC-2026-000001','currency':'USD',
        'subtotal':'100.00','tax_total':'16.00','discount_total':'0','total':'116.00',
        'balance_due':'116.00','amount_paid':'0','issue_date':'2026-11-04','client_name':'André <img src="https://evil"/>',
        'lines':[{'description':'Transport <b>fragile</b>','quantity':'2','unit_price':'50.00','line_total':'116.00'}]}


@pytest.mark.parametrize('value', ['123@g.us','243812345678@s.whatsapp.net','+00','https://evil/243812345678','123',None,'+243811111111,+243822222222'])
def test_private_phone_only(value):
    assert invoices.phone(value) is None


def test_normalizes_phone():
    assert invoices.phone('+243 (812) 345-678')=='+243812345678'


def test_real_pdf_is_escaped_and_paginated(doc):
    doc['lines'] *= 130
    content=render({'document':doc,'brand':{'organization_name':'Agence Étoile'},'settings':{}})
    assert content.startswith(b'%PDF-')
    assert content.endswith(b'%%EOF\n')
    assert content.count(b'/Type /Page\n')>1
    assert filename('../../FAC/0001')=='Facture-------FAC-0001.pdf'


@pytest.mark.parametrize('status',['DRAFT','VOID'])
def test_no_draft_or_void_send(doc,status):
    doc['status']=status
    c=MagicMock()
    assert invoices.queue(c,'agency',doc) is None
    with pytest.raises(HTTPException): invoices.queue(c,'agency',doc,'manual',automatic=False)
    c.execute.assert_not_called()


def test_opt_in_only_and_no_recipient_lookup_when_disabled(doc,monkeypatch):
    c=MagicMock();c.execute.return_value=result({'invoice_whatsapp_enabled':False})
    recipient=MagicMock();monkeypatch.setattr(invoices,'recipient',recipient)
    assert invoices.queue(c,'agency',doc) is None
    recipient.assert_not_called()


@pytest.mark.parametrize('dispatch,status',[('UNKNOWN','PENDING'),('CLAIMED','PENDING'),('IDLE','PENDING')])
def test_repeated_click_never_requeues_pending_or_ambiguous(doc,dispatch,status):
    c=MagicMock();c.execute.side_effect=[result({}),result({'id':'prior','request_key':'old','dispatch_state':dispatch,'status':status})]
    assert invoices.queue(c,'agency',doc,'new',automatic=False)=='prior'
    assert c.execute.call_count==2


def test_retry_same_request_after_sent_is_idempotent(doc):
    c=MagicMock();c.execute.side_effect=[result({}),result({'id':'prior','request_key':'same','dispatch_state':'ACCEPTED','status':'SENT'})]
    assert invoices.queue(c,'agency',doc,'same',automatic=False)=='prior'


def test_queue_snapshots_and_outbox_share_the_business_transaction(doc,monkeypatch):
    c=MagicMock();lines=result();lines.mappings.return_value=doc['lines']
    c.execute.side_effect=[result({'invoice_whatsapp_enabled':True,'legal_name':'Agence','secret':'never-copy'}),
        result(),result(),lines,result()]
    monkeypatch.setattr(invoices,'recipient',lambda *args:{'name':'André','phone':'+243812345678'})
    monkeypatch.setattr(invoices,'identity',lambda *args:{'name':'Agence'})
    outbox=MagicMock(return_value={'id':'notification'})
    monkeypatch.setattr(invoices,'create_notification_outbox',outbox)
    assert invoices.queue(c,'agency',doc)=='notification'
    assert outbox.call_args.kwargs['connection'] is c
    payload=c.execute.call_args.args[1]
    snapshot=json.loads(payload['snapshot'])
    assert 'secret' not in snapshot['settings']
    assert payload['o']=='agency' and payload['key']=='issued'
    assert snapshot['document']['lines']==doc['lines']


def test_auto_missing_phone_does_not_block_issuance_but_manual_explains(doc,monkeypatch):
    c=MagicMock();c.execute.side_effect=lambda *args:result({'invoice_whatsapp_enabled':True}) if 'finance_settings' in str(args[0]) else result()
    monkeypatch.setattr(invoices,'recipient',lambda *args:None)
    assert invoices.queue(c,'agency',doc) is None
    with pytest.raises(HTTPException) as error:
        invoices.queue(c,'agency',doc,'manual',automatic=False)
    assert 'numéro WhatsApp du client' in error.value.detail


@pytest.mark.parametrize('status,contact',[('VOID',{'phone':'+243812345678'}),('ISSUED',None),('ISSUED',{'phone':'+243899999999'})])
def test_dispatch_rechecks_void_opt_out_and_phone_change(status,contact,monkeypatch):
    c=MagicMock();c.execute.return_value=result({'client_id':'client','status':status,'document_type':'INVOICE','snapshot':{}})
    monkeypatch.setattr(invoices,'engine',MagicMock(connect=MagicMock(return_value=MagicMock(__enter__=MagicMock(return_value=c)))))
    monkeypatch.setattr(invoices,'recipient',lambda *args:contact)
    with pytest.raises(ValueError): invoices.prepare({'org_id':'agency','id':'notification','recipient_phone':'+243812345678'})
    assert c.execute.call_args.args[1]=={'o':'agency','n':'notification'}


def test_suppression_blocks_recipient(monkeypatch):
    c=MagicMock();c.execute.return_value=result({'phone':'+243812345678','name':'Client'})
    monkeypatch.setattr(invoices,'permitted',lambda *args:False)
    assert invoices.recipient(c,'agency','client') is None


@pytest.mark.parametrize('state,status,expected',[('UNKNOWN','PENDING','CHECK_REQUIRED'),('CLAIMED','PENDING','SENDING'),
    ('IDLE','PENDING','QUEUED'),('ACCEPTED','SENT','SENT'),('REJECTED','FAILED','FAILED')])
def test_business_status(monkeypatch,state,status,expected):
    c=MagicMock();c.execute.side_effect=[result(scalar=True),result({'status':status,'dispatch_state':state,'sent_at':None,'dispatch_started_at':datetime.now(timezone.utc)})]
    monkeypatch.setattr(invoices,'engine',MagicMock(connect=MagicMock(return_value=MagicMock(__enter__=MagicMock(return_value=c)))))
    assert invoices.status('agency','doc')['state']==expected


@pytest.fixture
def dispatch(monkeypatch):
    notification={'id':'notification','org_id':'agency','notification_type':'INVOICE_PDF:doc',
        'channel':'whatsapp','recipient_phone':'+243812345678','message':'Facture'}
    monkeypatch.setattr(sender,'claim_notification_dispatch',lambda *args:notification)
    for name in ('finish_notification_dispatch','mark_notification_sent','mark_notification_failed','_project_result'):
        monkeypatch.setattr(sender,name,MagicMock())
    provider=MagicMock()
    provider.send_document.return_value={'success':True,'provider_message_id':'sent','provider':'qr_linked_device'}
    monkeypatch.setattr(sender,'get_whatsapp_provider',lambda **kwargs:provider)
    monkeypatch.setattr(invoices,'prepare',MagicMock(return_value={'content':b'%PDF-test','filename':'Facture-1.pdf','dispatch_id':'notification'}))
    return provider


def test_dispatch_sends_document_never_plain_text(dispatch):
    assert sender.send_notification('agency','notification')['status']=='sent'
    dispatch.send_message.assert_not_called()
    assert dispatch.send_document.call_args.kwargs['content']==b'%PDF-test'


def test_render_failure_is_safe_to_retry_without_transport(dispatch,monkeypatch):
    invoices.prepare.side_effect=ValueError('no longer allowed')
    assert sender.send_notification('agency','notification')['status']=='failed'
    dispatch.send_document.assert_not_called()
    sender.finish_notification_dispatch.assert_called_with('agency','notification','REJECTED')


def test_send_timeout_never_auto_resends(dispatch):
    dispatch.send_document.side_effect=TimeoutError()
    assert sender.send_notification('agency','notification')['status']=='unknown'
    sender.finish_notification_dispatch.assert_called_with('agency','notification','UNKNOWN')
    sender.mark_notification_failed.assert_not_called()


def test_unsupported_provider_does_not_send_text(dispatch):
    dispatch.send_document=None
    assert sender.send_notification('agency','notification')['status']=='failed'
    dispatch.send_message.assert_not_called()


def test_issue_queues_on_same_transaction(doc,monkeypatch):
    from app.finance import repository
    c=MagicMock();c.execute.return_value=result(doc)
    monkeypatch.setattr(repository,'engine',MagicMock(begin=MagicMock(return_value=MagicMock(__enter__=MagicMock(return_value=c)))))
    monkeypatch.setattr(repository,'event',MagicMock());monkeypatch.setattr(repository,'_snapshot_due_obligations',MagicMock())
    enqueue=MagicMock();monkeypatch.setattr(invoices,'queue',enqueue)
    repository.issue('agency','doc','actor','Agent',1)
    enqueue.assert_called_once_with(c,'agency',doc)


def test_api_sends_only_after_issuance_committed(doc,monkeypatch):
    from app.api import finance
    monkeypatch.setattr(finance.repo,'issue',lambda *args:doc)
    bg=BackgroundTasks()
    assert finance.issue('doc',finance.Version(expected_version=1),bg,tenant={'org_id':'agency'})==doc
    assert bg.tasks[0].func is invoices.dispatch_pending


def test_qr_payload_is_signed_private_document(monkeypatch):
    from app.services import qr_linked_device_whatsapp_provider as qr
    request=MagicMock(return_value={'success':True,'provider_message_id':'sent'})
    monkeypatch.setattr(qr,'qr_gateway_request',request)
    provider=qr.QRLinkedDeviceWhatsAppProvider(org_id='agency',number={'provider':'QR_LINKED_DEVICE','provider_metadata':{'connection_id':'connection'}})
    assert provider.send_document('+243812345678','Facture',b'%PDF-test','Facture-1.pdf','notification')['success']
    payload=request.call_args.args[2]
    assert payload['org_id']=='agency' and payload['mime_type']=='application/pdf'
    assert 'url' not in payload
    with pytest.raises(ValueError):provider.send_document('123@g.us','Facture',b'%PDF-test','Facture-1.pdf','notification')
