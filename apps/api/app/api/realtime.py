from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import manager
from app.core.websocket_auth import authenticate_websocket
from app.db.presence_repository import update_presence


router = APIRouter()

@router.websocket("/ws/inbox/{manager_id}")
async def websocket_inbox(
    websocket: WebSocket,
    manager_id: str,
):
    auth = await authenticate_websocket(websocket)

    if not auth:
        return

    org_id = auth["org_id"]
    manager_id = auth["user_id"]
    manager_name = websocket.query_params.get(
        "manager_name",
        manager_id,
    )

    await manager.connect(
        org_id,
        manager_id,
        websocket,
    )

    update_presence(
        org_id=org_id,
        manager_id=manager_id,
        manager_name=manager_name,
        status="ONLINE",
    )

    await manager.broadcast_to_org(
        org_id,
        {
            "event": "PRESENCE",
            "org_id": org_id,
            "manager_id": manager_id,
            "manager_name": manager_name,
            "status": "ONLINE",
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            event = payload.get("event")

            if event == "TYPING":
                await manager.broadcast_to_org(
                    org_id,
                    {
                        **payload,
                        "org_id": org_id,
                    },
                )

            elif event == "ACTIVE_CONVERSATION":
                update_presence(
                    org_id=org_id,
                    manager_id=manager_id,
                    manager_name=manager_name,
                    status="ONLINE",
                    active_conversation=payload.get("phone"),
                )

                await manager.broadcast_to_org(
                    org_id,
                    {
                        "event": "PRESENCE",
                        "org_id": org_id,
                        "manager_id": manager_id,
                        "manager_name": manager_name,
                        "status": "ONLINE",
                        "active_conversation": payload.get("phone"),
                    }
                )

    except WebSocketDisconnect:
        manager.disconnect(
            org_id,
            manager_id,
        )

        update_presence(
            org_id=org_id,
            manager_id=manager_id,
            manager_name=manager_name,
            status="OFFLINE",
        )

        await manager.broadcast_to_org(
            org_id,
            {
                "event": "PRESENCE",
                "org_id": org_id,
                "manager_id": manager_id,
                "manager_name": manager_name,
                "status": "OFFLINE",
            }
        )
