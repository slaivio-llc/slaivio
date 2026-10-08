from unittest.mock import MagicMock
from datetime import date
import pytest
from fastapi import HTTPException
from app.api import clients as api
from app.clients import directory as repo


def test_directory_uses_tenant_scoped_minimal_projection(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.scalar_one.return_value = 51
    conn.execute.return_value.mappings.return_value = []
    result = repo.directory('office-a', q='CLI_%', customer_type='business', start=date(2026,1,1), end=date(2026,1,31),page=2)
    assert result['total_pages'] == 2
    for call in conn.execute.call_args_list:
        sql, params = call.args
        assert 'c.org_id=:org_id' in str(sql)
        assert 'c.deleted_at is null' in str(sql)
        assert params['org_id'] == 'office-a'
        assert params['q'] == '%CLI!_!%%'
        assert params['offset'] == 50
        assert "at time zone 'UTC'" in str(sql)
        assert 'current_balance' not in str(sql)
        assert 'dossiers' not in str(sql)


@pytest.mark.parametrize('kwargs', [{'sort':'name;drop table clients'}, {'customer_type':'VIP'}, {'start':date(2026,2,1),'end':date(2026,1,1)}])
def test_invalid_filters_rejected(kwargs):
    with pytest.raises(HTTPException) as exc:
        api.client_directory(tenant={'org_id':'a'},q='',page=1,**kwargs)
    assert exc.value.status_code == 422


@pytest.mark.parametrize('body', [
    {'name':' ', 'phone':'+243812345678'},
    {'name':'Jean'},
    {'company_name':'Company', 'customer_type':'agent'},
])
def test_cargo_creation_requires_real_identity(monkeypatch, body):
    create = MagicMock()
    monkeypatch.setattr(api, 'create_client', create)
    with pytest.raises(HTTPException) as exc:
        api.clients_create(api.ClientPayload(**body),{'org_id':'a','user_id':'u','organization_type':'PARCEL_FREIGHT'})
    assert exc.value.status_code == 422
    create.assert_not_called()


def test_company_can_be_created_without_phone_and_derives_office_location(monkeypatch):
    create=MagicMock(return_value={'id':'new'})
    monkeypatch.setattr(api,'create_client',create)
    api.clients_create(api.ClientPayload(company_name='Company',customer_type='business'),
        {'org_id':'a','user_id':'u','organization_type':'PARCEL_FREIGHT','country':'BF','city':'Ouagadougou'})
    payload=create.call_args.args[2]
    assert payload['country']=='BF'
    assert payload['city']=='Ouagadougou'
    assert payload['phone'] is None


@pytest.mark.parametrize('patch, expected', [
    ({'phone': ''}, 422),
    ({'name': ' '}, 422),
    ({'customer_type': 'business'}, 422),
    ({'row_version': 1, 'address': 'New address'}, 409),
])
def test_cargo_edit_rejects_invalid_identity_or_stale_version(monkeypatch, patch, expected):
    existing = {'name': 'Jean', 'phone': '+243812345678',
                'customer_type': 'individual', 'row_version': 2}
    read = MagicMock(return_value=existing)
    update = MagicMock()
    monkeypatch.setattr(api, 'get_client', read)
    monkeypatch.setattr(api, 'update_client', update)
    with pytest.raises(HTTPException) as exc:
        api.clients_update('client-a', api.ClientPatchPayload(**{'row_version': 2, **patch}),
                           {'org_id': 'office-a', 'organization_type': 'CARGO'})
    assert exc.value.status_code == expected
    read.assert_called_once_with('office-a', 'client-a')
    update.assert_not_called()


def test_cargo_partial_edit_preserves_omitted_fields(monkeypatch):
    monkeypatch.setattr(api, 'get_client', MagicMock(return_value={
        'name': 'Jean', 'phone': '+243812345678',
        'customer_type': 'individual', 'row_version': 2,
    }))
    update = MagicMock(return_value={'id': 'client-a'})
    monkeypatch.setattr(api, 'update_client', update)
    api.clients_update('client-a', api.ClientPatchPayload(row_version=2, address='New address'),
                       {'org_id': 'office-a', 'organization_type': 'CARGO'})
    assert update.call_args.args[3] == {'row_version': 2, 'address': 'New address'}
