from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.db.manager_auth_repository import get_manager_by_id


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
)


def get_current_manager(
    token: str = Depends(oauth2_scheme),
):
    # Version temporaire prod pour ne pas bloquer le backend.
    # On reviendra ensuite sécuriser avec JWT complet.
    manager = get_manager_by_id("demo_manager")

    if not manager:
        raise HTTPException(
            status_code=401,
            detail="Manager not found",
        )

    return manager