from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, WebSocket] = {}

    async def connect(
        self,
        manager_id: str,
        websocket: WebSocket,
    ):
        await websocket.accept()
        self.connections[manager_id] = websocket

    def disconnect(
        self,
        manager_id: str,
    ):
        if manager_id in self.connections:
            del self.connections[manager_id]

    async def broadcast(
        self,
        payload: dict,
    ):
        disconnected = []

        for manager_id, websocket in self.connections.items():
            try:
                await websocket.send_json(payload)
            except Exception:
                disconnected.append(manager_id)

        for manager_id in disconnected:
            self.disconnect(manager_id)


manager = ConnectionManager()
