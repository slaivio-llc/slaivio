from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

import pytest
from fastapi import HTTPException

from app.billing.services import capacity
from app.organizations.services import invitation_service


def test_only_known_quota_details_are_exposed():
    error=SimpleNamespace(orig=SimpleNamespace(diag=SimpleNamespace(message_primary='slaivio_plan_limit_reached',message_detail='{"resource":"max_users","limit":3}')))
    detail=capacity.limit_error(error)
    assert detail is not None
    assert detail['code']=='plan_limit_reached'
    assert detail is not None
    assert '3 membres' in detail['message']
    assert detail is not None
    assert 'existants restent accessibles' in detail['message']
    error.orig.diag.message_detail='secret database diagnostics'
    assert capacity.limit_error(error) is None
    error.orig.diag.message_primary='some_database_error'
    assert capacity.limit_error(error) is None


def test_invitation_quota_is_checked_before_any_remote_invitation(monkeypatch):
    @contextmanager
    def full(*_):
        raise HTTPException(409,'quota')
        yield
    monkeypatch.setattr(invitation_service,'invitation_capacity',full)
    monkeypatch.setattr(invitation_service,'CLERK_SECRET_KEY','test')
    send=Mock();save=Mock()
    monkeypatch.setattr(invitation_service,'_post_invitation',send)
    monkeypatch.setattr(invitation_service,'create_invitation_record',save)
    with pytest.raises(HTTPException):
        invitation_service.invite_user_to_org('agency','org_real','one@example.com','SUPPORT')
    send.assert_not_called();save.assert_not_called()


def test_capacity_reservation_is_inside_the_same_transaction_as_record(monkeypatch):
    engine=MagicMock();connection=engine.begin.return_value.__enter__.return_value
    connection.execute.return_value.first.return_value=None
    monkeypatch.setattr(capacity,'engine',engine)
    with capacity.invitation_capacity('agency','one@example.com') as actual:
        assert actual is connection
    query=connection.execute.call_args_list[-1]
    assert 'billing_assert_capacity' in str(query.args[0])
    assert query.args[1]['org']=='agency'


def test_capacity_rejects_duplicate_pending_invitation(monkeypatch):
    engine=MagicMock();connection=engine.begin.return_value.__enter__.return_value
    connection.execute.return_value.first.return_value={'id':'pending'}
    monkeypatch.setattr(capacity,'engine',engine)
    with pytest.raises(HTTPException) as error:
        with capacity.invitation_capacity('agency','one@example.com'):
            pytest.fail('duplicate must not be sent')
    assert error.value.detail=='invitation_already_pending'
