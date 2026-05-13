import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.db.manager_event_repository import (
    list_manager_events,
    list_manager_events_after_id,
    mark_manager_event_read,
)


router = APIRouter()

ORG_ID = "demo_agency"


def json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [json_safe(item) for item in value]

    return value


def sse_event(event: dict) -> str:
    safe_event = json_safe(event)

    return (
        f"id: {safe_event['id']}\n"
        f"event: {safe_event['event_type']}\n"
        f"data: {json.dumps(safe_event)}\n\n"
    )


@router.get("/manager/events")
def get_manager_events(
    unread_only: bool = False,
    limit: int = 100,
):
    events = list_manager_events(
        org_id=ORG_ID,
        unread_only=unread_only,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(events),
        "events": events,
    }


@router.patch("/manager/events/{event_id}/read")
def mark_event_read(event_id: str):
    event = mark_manager_event_read(
        org_id=ORG_ID,
        event_id=event_id,
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Manager event not found",
        )

    return {
        "status": "ok",
        "event": event,
    }


@router.get("/manager/events/stream")
async def stream_manager_events(
    last_event_id: str | None = Query(default=None),
):
    async def event_generator():
        current_last_id = last_event_id

        while True:
            events = list_manager_events_after_id(
                org_id=ORG_ID,
                last_event_id=current_last_id,
                limit=20,
            )

            for event in events:
                current_last_id = str(event["id"])
                yield sse_event(event)

            yield "event: heartbeat\ndata: {}\n\n"

            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
