import os

import requests
from cachetools import TTLCache, cached
from fastapi import HTTPException
from jose import jwt


JWKS_URL = os.getenv("CLERK_JWKS_URL")

_jwks_cache = TTLCache(maxsize=1, ttl=3600)


@cached(_jwks_cache)
def get_jwks():
    if not JWKS_URL:
        raise HTTPException(
            status_code=500,
            detail="clerk_jwks_url_missing",
        )

    response = requests.get(
        JWKS_URL,
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

