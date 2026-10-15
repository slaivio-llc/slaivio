from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from app.api import finance as api
from app.finance import office_scope, repository

DOC='00000000-0000-0000-0000-000000000001'

def request(path, method='GET', document=False):
    return Request({'type':'http','method':method,'path':path,'headers':[],
                    'path_params':{'document_id':DOC} if document else {}})

@pytest.mark.parametrize('endpoint',['','/stats','/export'])
def test_scoped_lists_are_allowed(endpoint):
    api.require_finance_scope(request('/finance'+endpoint),
        {'office_access_scope':'SELECTED_OFFICES','allowed_office_ids':[]},{'org_id':'agency'})

@pytest.mark.parametrize('suffix,method', [('', 'GET'),('/print','GET'),('/payments/p/receipt','GET'),
    ('/payments','POST'),('/payments/p/reverse','POST'),('/issue','POST'),('/void','POST')])
def test_document_actions_check_office(monkeypatch,suffix,method):
    check=MagicMock()
    monkeypatch.setattr(api,'require_document',check)
    api.require_finance_scope(request('/finance/'+DOC+suffix,method,True),
        {'selected_office_id':'office'}, {'org_id':'agency'})
    check.assert_called_once_with('agency',DOC,['office'])

@pytest.mark.parametrize('suffix',['/convert','/apply-credit','/office'])
def test_global_actions_remain_restricted(monkeypatch,suffix):
    monkeypatch.setattr(api,'require_document',MagicMock())
    with pytest.raises(HTTPException) as exc:
        api.require_finance_scope(request('/finance/'+DOC+suffix,'POST',True),
            {'selected_office_id':'office'},{'org_id':'agency'})
    assert exc.value.status_code==403

def test_missing_and_unassigned_documents_hidden(monkeypatch):
    engine=MagicMock()
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.first.return_value=None
    monkeypatch.setattr(repository,'engine',engine)
    with pytest.raises(HTTPException) as exc:
        office_scope.require_document('agency',DOC,[])
    assert exc.value.status_code==404
    assert conn.execute.call_args.args[1]['offices']==[]

def test_both_stats_queries_apply_scope(monkeypatch):
    engine=MagicMock()
    conn=engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.one.return_value={}
    conn.execute.return_value.mappings.return_value.all.return_value=[]
    monkeypatch.setattr(repository,'engine',engine)
    repository.stats('agency',office_ids=['office'])
    for call in conn.execute.call_args_list:
        assert 'office_id=any' in str(call.args[0])
        assert call.args[1]['unrestricted'] is False
        assert call.args[1]['offices']==['office']

def test_export_forwards_scope(monkeypatch):
    load=MagicMock(return_value={'items':[]})
    monkeypatch.setattr(repository,'list_documents',load)
    repository.export('agency',office_ids=[])
    assert load.call_args.kwargs['office_ids']==[]

def test_credit_cannot_be_applied_across_offices(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    credit={'id':'credit','client_id':'client','currency':'USD','office_id':'office-a'}
    invoice={'id':'invoice','client_id':'client','currency':'USD','office_id':'office-b'}
    conn.execute.side_effect=[
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value=credit)))),
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value=invoice)))),
    ]
    monkeypatch.setattr(repository,'engine',engine)
    with pytest.raises(HTTPException) as exc:
        repository.apply_credit('agency','credit','invoice','actor','Agent',1)
    assert exc.value.status_code==409
    assert exc.value.detail=='credit_office_mismatch'
    assert conn.execute.call_count==2

def test_credit_can_be_applied_within_the_same_office(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    credit={'id':'credit','client_id':'client','currency':'USD','office_id':'office-a','total':100,'credit_applied':0}
    invoice={'id':'invoice','client_id':'client','currency':'USD','office_id':'office-a','balance_due':75}
    credit_update=MagicMock()
    invoice_update=MagicMock()
    conn.execute.side_effect=[
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value=credit)))),
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value=invoice)))),
        MagicMock(first=MagicMock(return_value=None)),
        credit_update,
        invoice_update,
    ]
    monkeypatch.setattr(repository,'engine',engine)
    audit=MagicMock();monkeypatch.setattr(repository,'event',audit)
    result=repository.apply_credit('agency','credit','invoice','actor','Agent',1)
    assert result=={'amount':75,'invoice_balance':0}
    assert conn.execute.call_count==5
    assert audit.call_args_list[0].args[3]=='CREDIT_APPLIED'

def test_credit_cannot_be_applied_while_saspay_checkout_is_open(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    credit={'id':'credit','client_id':'client','currency':'USD','office_id':'office-a'}
    invoice={'id':'invoice','client_id':'client','currency':'USD','office_id':'office-a'}
    conn.execute.side_effect=[
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value=credit)))),
        MagicMock(mappings=MagicMock(return_value=MagicMock(first=MagicMock(return_value=invoice)))),
        MagicMock(first=MagicMock(return_value={'id':'attempt'})),
    ]
    monkeypatch.setattr(repository,'engine',engine)
    with pytest.raises(HTTPException) as exc:
        repository.apply_credit('agency','credit','invoice','actor','Agent',1)
    assert exc.value.status_code==409
    assert exc.value.detail=='saspay_attempt_open'
    assert conn.execute.call_count==3

def test_assignment_is_audited_and_versioned(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value={'id':DOC,'office_id':'office'}
    monkeypatch.setattr(repository,'engine',engine)
    audit=MagicMock();monkeypatch.setattr(repository,'event',audit)
    office_scope.assign_office('agency',DOC,'office',4,'actor','Agent')
    query=conn.execute.call_args_list[1]
    assert 'office_id is null and row_version=:version' in str(query.args[0])
    assert query.args[1]['version']==4
    assert audit.call_args.args[3]=='OFFICE_ASSIGNED'
