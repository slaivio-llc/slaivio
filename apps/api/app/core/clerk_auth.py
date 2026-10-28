import requests
from cachetools import TTLCache, cached
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from fastapi import HTTPException
import jwt
from jwt import InvalidTokenError
from jwt.algorithms import RSAAlgorithm
from typing import cast
from urllib.parse import urlsplit

from app.core.config import settings


def _resolve_jwks_url() -> str | None:
    if settings.clerk_jwks_url:
        return settings.clerk_jwks_url
    if settings.clerk_issuer_url:
        return f"{settings.clerk_issuer_url.rstrip('/')}/.well-known/jwks.json"
    return None

_jwks_cache = TTLCache(maxsize=1, ttl=3600)


def _authorized_parties() -> set[str]:
    configured = settings.clerk_authorized_parties
    if configured:
        return {value.strip().rstrip('/') for value in configured.split(',') if value.strip()}
    web = urlsplit(settings.public_web_base_url)
    allowed = {f'{web.scheme}://{web.netloc}'} if web.scheme and web.netloc else set()
    if settings.app_env not in ('production', 'staging'):
        allowed.update({'http://localhost:3000', 'http://127.0.0.1:3000'})
    return allowed


@cached(_jwks_cache)
def get_jwks():
    jwks_url = _resolve_jwks_url()
    if not jwks_url:
        raise HTTPException(
            status_code=500,
            detail="clerk_jwks_url_missing",
        )

    response = requests.get(
        jwks_url,
        timeout=20,
    )
    response.raise_for_status()

    return response.json()


def verify_clerk_token(
    token: str,
):
    try:
        jwks = get_jwks()
        header = jwt.get_unverified_header(token)
        key = next(
            (
                item
                for item in jwks["keys"]
                if item["kid"] == header["kid"]
            ),
            None,
        )
    except (InvalidTokenError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=401,
            detail="invalid_clerk_token",
        ) from exc

    if not key:
        raise HTTPException(status_code=401, detail="clerk_key_not_found")

    try:
        public_key = cast(RSAPublicKey, RSAAlgorithm.from_jwk(key))
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer_url,
            options={
                "require": ["exp", "iat", "nbf", "sub"],
                "verify_aud": False,
                "verify_iss": bool(settings.clerk_issuer_url),
            },
        )
        # Clerk can omit azp for navigation requests without an Origin header.
        # When present, it must match an explicit application origin, not a
        # suffix or arbitrary subdomain. The signed claim cannot be overridden
        # by a request header.
        party = claims.get('azp')
        if party is not None and (not isinstance(party, str) or party not in _authorized_parties()):
            raise InvalidTokenError('untrusted_authorized_party')
        return claims
    except (InvalidTokenError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=401,
            detail="invalid_clerk_token",
        ) from exc
