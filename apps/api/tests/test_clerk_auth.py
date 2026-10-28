import pytest
from fastapi import HTTPException
import jwt
import time
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from app.core.clerk_auth import verify_clerk_token


@pytest.fixture
def signing_key(monkeypatch):
    from app.core import clerk_auth
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
    public['kid'] = 'test-session'
    monkeypatch.setattr(clerk_auth, 'get_jwks', lambda: {'keys': [public]})
    monkeypatch.setattr(clerk_auth.settings, 'clerk_issuer_url', 'https://clerk.example.test')
    return key


def session_claims():
    now = int(time.time())
    return {'sub': 'user_test', 'iss': 'https://clerk.example.test', 'iat': now, 'nbf': now, 'exp': now + 60}


@pytest.mark.parametrize('missing', ['exp', 'iat', 'nbf', 'sub'])
def test_session_requires_lifetime_and_identity_claims(signing_key, missing):
    claims = session_claims()
    del claims[missing]
    token = jwt.encode(claims, signing_key, algorithm='RS256', headers={'kid': 'test-session'})
    with pytest.raises(HTTPException) as error:
        verify_clerk_token(token)
    assert error.value.status_code == 401


def test_valid_signed_session_still_authenticates(signing_key):
    token = jwt.encode(session_claims(), signing_key, algorithm='RS256', headers={'kid': 'test-session'})
    assert verify_clerk_token(token)['sub'] == 'user_test'


@pytest.mark.parametrize('party', ['https://evil.example', 'https://slaivio.com.evil.example', 'https://slaivio.com/', ['https://slaivio.com']])
def test_signed_session_from_another_origin_is_rejected(signing_key, monkeypatch, party):
    from app.core import clerk_auth
    monkeypatch.setattr(clerk_auth.settings, 'clerk_authorized_parties', 'https://slaivio.com')
    token = jwt.encode({**session_claims(), 'azp': party}, signing_key, algorithm='RS256', headers={'kid': 'test-session'})
    with pytest.raises(HTTPException) as error:
        verify_clerk_token(token)
    assert error.value.status_code == 401


def test_explicit_application_origins_are_accepted(signing_key, monkeypatch):
    from app.core import clerk_auth
    monkeypatch.setattr(clerk_auth.settings, 'clerk_authorized_parties', 'https://slaivio.com, https://www.slaivio.com')
    token = jwt.encode({**session_claims(), 'azp': 'https://www.slaivio.com'}, signing_key, algorithm='RS256', headers={'kid': 'test-session'})
    assert verify_clerk_token(token)['sub'] == 'user_test'


def test_production_default_does_not_authorize_localhost(monkeypatch):
    from app.core import clerk_auth
    monkeypatch.setattr(clerk_auth.settings, 'app_env', 'production')
    monkeypatch.setattr(clerk_auth.settings, 'clerk_authorized_parties', None)
    monkeypatch.setattr(clerk_auth.settings, 'public_web_base_url', 'https://slaivio.com')
    assert clerk_auth._authorized_parties() == {'https://slaivio.com'}


def test_malformed_clerk_token_returns_unauthorized(monkeypatch) -> None:
    monkeypatch.setattr("app.core.clerk_auth.get_jwks", lambda: {"keys": []})

    with pytest.raises(HTTPException) as error:
        verify_clerk_token("not-a-jwt")

    assert error.value.status_code == 401
    assert error.value.detail == "invalid_clerk_token"


def test_unknown_clerk_key_returns_unauthorized(monkeypatch) -> None:
    monkeypatch.setattr("app.core.clerk_auth.get_jwks", lambda: {"keys": []})
    token_with_unknown_key = jwt.encode(
        {"sub": "user_123"},
        "test-only-secret-with-32-bytes-minimum",
        algorithm="HS256",
        headers={"kid": "unknown"},
    )

    with pytest.raises(HTTPException) as error:
        verify_clerk_token(token_with_unknown_key)

    assert error.value.status_code == 401
    assert error.value.detail == "clerk_key_not_found"
