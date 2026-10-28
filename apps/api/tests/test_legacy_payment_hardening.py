from fastapi.routing import APIRoute
from unittest.mock import MagicMock
import pytest

from app.payments.services import payment_service
from app.payments.repositories import payment_repository
from app.api.media import router as media_router


@pytest.mark.parametrize('environment', ['production', 'staging'])
def test_mock_provider_is_never_used_in_deployed_environments(monkeypatch, environment):
    monkeypatch.setattr(payment_service.settings, 'app_env', environment)
    lookup = MagicMock()
    monkeypatch.setattr(payment_service, 'get_payment_provider', lookup)
    with pytest.raises(ValueError, match='legacy_payment_simulator_disabled'):
        payment_service.resolve_payment_provider('anything')
    lookup.assert_not_called()


def test_legacy_status_update_is_scoped_by_agency_and_provider(monkeypatch):
    engine, conn = MagicMock(), MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    conn.execute.return_value.fetchone.return_value = None
    monkeypatch.setattr(payment_repository, 'engine', engine)
    assert payment_repository.update_payment_request_status('agency-a', 'provider-a', 'reference', 'FAILED') is None
    sql, params = conn.execute.call_args.args
    query = ' '.join(str(sql).split())
    assert 'where org_id = :org_id and provider_code = :provider_code' in query
    assert params['org_id'] == 'agency-a'
    assert params['provider_code'] == 'provider-a'


def test_media_sending_requires_the_same_permission_as_inbox_replies():
    route = next(route for route in media_router.routes if isinstance(route, APIRoute) and route.path == '/media/send-whatsapp')
    permissions = [cell.cell_contents for dependency in route.dependant.dependencies
                   for cell in (getattr(dependency.call, '__closure__', None) or ())
                   if isinstance(cell.cell_contents, str)]
    assert 'inbox.reply' in permissions
