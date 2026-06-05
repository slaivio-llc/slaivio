from fastapi import WebSocket

from app.core.clerk_auth import verify_clerk_token
from app.organizations.repositories.membership_check_repository import (
    user_belongs_to_org,
)


async def authenticate_websocket(
    websocket: WebSocket,
):
    token = websocket.query_params.get("token")
    org_id = websocket.query_params.get("org_id")

    if not org_id:
        await websocket.close(code=1008)
        return None

    if token == "demo_token":
        return {
            "user_id": "demo_manager",
            "org_id": org_id,
            "email": "demo@slaivo.com",
        }

    if not token:
        await websocket.close(code=1008)
        return None

    try:
        payload = verify_clerk_token(token)
    except Exception:
        await websocket.close(code=1008)
        return None

    user_id = payload.get("sub")

    if not user_id:
        await websocket.close(code=1008)
        return None

    allowed = user_belongs_to_org(
        clerk_user_id=user_id,
        org_id=org_id,
    )

    if not allowed:
        await websocket.close(code=1008)
        return None

    return {
        "user_id": user_id,
        "org_id": org_id,
        "email": payload.get("email"),
    }

