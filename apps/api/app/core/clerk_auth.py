import os

import requests
from cachetools import TTLCache, cached
from fastapi import HTTPException
from jose import jwt


CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")
JWKS_URL = os.getenv("CLERK_JWKS_URL")


def _resolve_jwks_url() -> str | None:
    if JWKS_URL:
        return JWKS_URL
    if CLERK_ISSUER_URL:
        return f"{CLERK_ISSUER_URL.rstrip('/')}/.well-known/jwks.json"
    return None

_jwks_cache = TTLCache(maxsize=1, ttl=3600)


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

    if not key:
        raise HTTPException(
            status_code=401,
            detail="clerk_key_not_found",
        )

    return jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        options={
            "verify_aud": False,
        },
    )
