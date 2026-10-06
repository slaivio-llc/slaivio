from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.organization_network import OfficeCreate
from app.organization_network import repository


def payload(kind):
    return OfficeCreate(workspace_kind=kind, organization_name='LUZA Chine',
        office_code='CN-01', country='Chine', country_code='CN', city='Guangzhou').model_dump()


def test_workspace_kind_does_not_accept_unrecognised_scopes():
    with pytest.raises(ValidationError):
        payload('GLOBAL_ADMIN')


@pytest.mark.parametrize('kind', ['OFFICE', 'WAREHOUSE'])
def test_workspace_creation_binds_kind_and_preserves_local_ownership(monkeypatch, kind):
    conn = MagicMock()
    statements = []

    def execute(statement, params):
        assert set(statement.compile().params) <= params.keys()
        statements.append((str(statement), params))
        result = MagicMock()
        result.mappings.return_value.first.return_value = {'network_role': 'OWNER', 'access_scope': 'ALL_OFFICES'}
        result.mappings.return_value.one.return_value = {'id': 'country-id'}
        return result

    conn.execute.side_effect = execute
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, 'engine', engine)
    monkeypatch.setattr(repository, '_current_network', lambda *args: {
        'group_id': 'network-id', 'organization_type': 'PARCEL_FREIGHT', 'network_name': 'LUZA',
    })
    monkeypatch.setattr(repository, 'provision_organization', lambda **kwargs: {'id': 'new-office'})
    membership = MagicMock()
    monkeypatch.setattr(repository, 'sync_membership_with_role', membership)
    monkeypatch.setattr(repository, 'context', lambda *args: {'offices': []})
    repository.create_office('source-office', {'user_id': 'owner'}, payload(kind))
    updates = [params for sql, params in statements if 'update organizations set group_id' in sql]
    assert updates[0]['workspace_kind'] == kind
    assert updates[0]['office_id'] == 'new-office'
    warehouse_inserts = [params for sql, params in statements if 'insert into warehouses(' in sql]
    assert bool(warehouse_inserts) == (kind == 'WAREHOUSE')
    if warehouse_inserts:
        assert warehouse_inserts[0]['office_id'] == 'new-office'
    assert membership.call_args.kwargs['org_id'] == 'new-office'


def test_vehicle_workspace_cannot_create_parcel_network(monkeypatch):
    conn = MagicMock()
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, 'engine', engine)
    monkeypatch.setattr(repository, '_current_network', lambda *args: {'organization_type': 'VEHICLE_IMPORT'})
    provision = MagicMock()
    monkeypatch.setattr(repository, 'provision_organization', provision)
    with pytest.raises(HTTPException) as exc:
        repository.create_office('vehicle-office', {'user_id': 'owner'}, payload('OFFICE'))
    assert exc.value.status_code == 409
    provision.assert_not_called()


def test_non_owner_cannot_bootstrap_a_network(monkeypatch):
    conn = MagicMock()
    conn.execute.return_value.first.return_value = None
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, 'engine', engine)
    monkeypatch.setattr(repository, '_current_network', lambda *args: {'organization_type': 'PARCEL_FREIGHT', 'group_id': None})
    with pytest.raises(HTTPException) as exc:
        repository.create_office('office', {'user_id': 'operator'}, payload('WAREHOUSE'))
    assert exc.value.status_code == 403
