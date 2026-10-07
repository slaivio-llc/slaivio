from unittest.mock import MagicMock

import pytest

from app.notification_center.navigation import notification_href
from app.notification_center import repository
from app.api import notification_center


@pytest.mark.parametrize('kind,permission,expected', [
    ('CLIENT', 'clients.read', '/app/clients?open=abc'),
    ('DOSSIER', 'dossiers.read', '/app/dossiers/abc'),
    ('PACKAGE', 'packages.read', '/app/packages?open=abc'),
    ('EXPEDITION', 'shipments.read', '/app/shipments/abc'),
])
def test_reference_requires_resource_permission(kind, permission, expected):
    item = {'resource_kind': kind, 'resource_id': 'abc'}
    assert notification_href(item, [permission]) == expected
    assert notification_href(item, []) == '/app/notifications'


def test_legacy_reference_and_message_text_cannot_invent_destination():
    item = {'resource_kind': 'LEGACY_SHIPMENT', 'resource_id': 'abc',
            'title': 'PACKAGE PAYMENT CLIENT', 'message': 'https://example.com'}
    assert notification_href(item, ['shipments.read']) == '/app/notifications'
    assert notification_href({'resource_kind': 'CLIENT'}, ['clients.read']) == '/app/notifications'


def test_reference_is_url_encoded():
    assert notification_href({'resource_kind': 'CLIENT', 'resource_id': 'a&open=b'},
                             ['clients.read']) == '/app/clients?open=a%26open%3Db'


def test_listing_resolves_permissions_in_active_office(monkeypatch):
    monkeypatch.setattr(repository, 'list_center', MagicMock(return_value={
        'items': [{'resource_kind': 'CLIENT', 'resource_id': 'abc'}]}))
    permissions = MagicMock(return_value=['clients.read'])
    monkeypatch.setattr(notification_center, 'list_permissions_for_user', permissions)
    result = notification_center.listing(tenant={'org_id': 'office-a'},
                                        manager={'user_id': 'agent-a'}, page=1, page_size=20)
    permissions.assert_called_once_with(user_id='agent-a', org_id='office-a')
    assert result['items'][0]['href'] == '/app/clients?open=abc'


def test_query_keeps_personal_unread_override_and_excludes_snoozed_from_total(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repository, 'engine', engine)
    connection = engine.connect.return_value.__enter__.return_value
    connection.execute.return_value.scalar_one.return_value = 0
    connection.execute.return_value.mappings.return_value.one.return_value = {}
    repository.list_center('office-a', 'agent-a')
    statement, params = connection.execute.call_args_list[0].args
    query = str(statement)
    assert 'when s.notification_id is not null then s.read_at' in query
    assert 'where (snoozed_until is null or snoozed_until<=now())' in query
    assert params['o'] == 'office-a'
    assert params['u'] == 'agent-a'


def test_cargo_links_join_existing_records_in_same_office(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repository, 'engine', engine)
    connection = engine.connect.return_value.__enter__.return_value
    connection.execute.return_value.scalar_one.return_value = 0
    connection.execute.return_value.mappings.return_value.one.return_value = {}
    repository.list_center('office-a', 'agent-a')
    query = str(connection.execute.call_args_list[0].args[0])
    assert 'pn.org_id=n.org_id and pn.notification_outbox_id=n.id' in query
    assert 'package.org_id=n.org_id and package.id=pn.package_id' in query
    assert 'package.deleted_at is null' in query
    assert 'expedition.org_id=n.org_id and expedition.archived_at is null' in query
    assert "split_part(n.notification_type,':',1)='EXPEDITION_ASSIGNED'" in query
    assert "split_part(n.notification_type,':',3)=package.id::text" in query
    assert "array_length(string_to_array(n.notification_type,':'),1)=3" in query
