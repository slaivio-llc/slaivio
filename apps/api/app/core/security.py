from fastapi import Header, HTTPException

from app.core.config import settings


def require_manager_api_key(
    x_manager_api_key: str | None = Header(default=None),
):
    if x_manager_api_key != settings.manager_api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid manager API key",
        )

    return True
