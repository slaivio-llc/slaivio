from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import manager
from app.db.presence_repository import update_presence


router = APIRouter()

ORG_ID = "demo_agency"


@router.websocket("/ws/inbox/{manager_id}")
async def websocket_inbox(
    websocket: WebSocket,
    manager_id: str,
):
    manager_name = websocket.query_params.get(
        "manager_name",
        manager_id,
    )

    await manager.connect(
        manager_id,
        websocket,
    )

    update_presence(
        org_id=ORG_ID,
        manager_id=manager_id,
        manager_name=manager_name,
        status="ONLINE",
    )

    await manager.broadcast(
        {
            "event": "PRESENCE",
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
                await manager.broadcast(payload)

            elif event == "ACTIVE_CONVERSATION":
                update_presence(
                    org_id=ORG_ID,
                    manager_id=manager_id,
                    manager_name=manager_name,
                    status="ONLINE",
                    active_conversation=payload.get("phone"),
                )

                await manager.broadcast(
                    {
                        "event": "PRESENCE",
                        "manager_id": manager_id,
                        "manager_name": manager_name,
                        "status": "ONLINE",
                        "active_conversation": payload.get("phone"),
                    }
                )

    except WebSocketDisconnect:
        manager.disconnect(manager_id)

        update_presence(
            org_id=ORG_ID,
            manager_id=manager_id,
            manager_name=manager_name,
            status="OFFLINE",
        )

        await manager.broadcast(
            {
                "event": "PRESENCE",
                "manager_id": manager_id,
                "manager_name": manager_name,
                "status": "OFFLINE",
            }
        )
