from unittest.mock import Mock

import pytest
import requests
from fastapi import HTTPException

from app.billing.services import billing_identity as identity
from app.api import billing


def test_authenticated_email_is_not_replaced_by_browser_input(monkeypatch):
    checkout = Mock(return_value={'status': 'PENDING'})
    monkeypatch.setattr(billing.saspay_service, 'start_checkout', checkout)
    body = billing.CheckoutRequest(plan_code='PRO', customer_email='attacker@example.com', customer_name='Untrusted')
    billing.create_checkout(body, {'org_id': 'agency'}, {'email': 'owner@example.com', 'full_name': 'Awa Sossou'})
    checkout.assert_called_once_with('agency', 'PRO', 'owner@example.com', 'Awa Sossou')


def test_default_clerk_token_resolves_primary_not_first_email(monkeypatch):
    monkeypatch.setenv('CLERK_SECRET_KEY', 'test-secret')
    response = Mock()
    response.json.return_value = {'primary_email_address_id': 'primary', 'first_name': 'Awa', 'last_name': 'Sossou',
                                 'email_addresses': [{'id': 'old', 'email_address': 'old@example.com'},
                                                     {'id': 'primary', 'email_address': 'awa@example.com'}]}
    fetch = Mock(return_value=response)
    monkeypatch.setattr(identity.requests, 'get', fetch)
    assert identity.billing_identity({'user_id': 'user_123'}) == {'email': 'awa@example.com', 'name': 'Awa Sossou'}
    assert fetch.call_args.args == ('https://api.clerk.com/v1/users/user_123',)
    assert fetch.call_args.kwargs['timeout'] == 10


def test_identity_outage_never_creates_a_checkout(monkeypatch):
    monkeypatch.setenv('CLERK_SECRET_KEY', 'test-secret')
    monkeypatch.setattr(identity.requests, 'get', Mock(side_effect=requests.Timeout))
    checkout = Mock()
    monkeypatch.setattr(billing.saspay_service, 'start_checkout', checkout)
    with pytest.raises(HTTPException) as exc:
        billing.create_checkout(billing.CheckoutRequest(), {'org_id': 'agency'}, {'user_id': 'user_123'})
    assert exc.value.status_code == 503
    checkout.assert_not_called()


def test_invoice_overview_survives_identity_outage(monkeypatch):
    monkeypatch.setattr(billing, 'get_billing_overview', Mock(return_value={'invoices': ['invoice']}))
    monkeypatch.setattr(billing, 'billing_identity', Mock(side_effect=HTTPException(503, 'unavailable')))
    assert billing.get_billing({'org_id': 'agency'}, {})['billing'] == {'invoices': ['invoice'], 'payer': None}


@pytest.mark.parametrize('email', ['', 'invalid', 'a\n@example.com'])
def test_invalid_identity_fails_closed(monkeypatch, email):
    monkeypatch.delenv('CLERK_SECRET_KEY', raising=False)
    with pytest.raises(HTTPException):
        identity.billing_identity({'email': email})
