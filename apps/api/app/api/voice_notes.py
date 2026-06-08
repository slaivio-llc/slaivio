from fastapi import APIRouter, Depends, HTTPException

from app.core.tenant_context import get_current_tenant
from app.db.voice_transcription_repository import (
    list_pending_voice_transcriptions,
    get_voice_transcription,
)

from app.services.voice_note_service import (
    process_voice_transcription,
    process_due_voice_transcriptions,
)


router = APIRouter()


@router.get("/voice-notes/pending")
def get_pending_voice_notes(
    limit: int = 20,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    jobs = list_pending_voice_transcriptions(
        org_id=org_id,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(jobs),
        "voice_notes": jobs,
    }


@router.get("/voice-notes/{transcription_id}")
def get_voice_note(transcription_id: str, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    job = get_voice_transcription(
        org_id=org_id,
        transcription_id=transcription_id,
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Voice transcription not found",
        )

    return {
        "status": "ok",
        "voice_note": job,
    }


@router.post("/voice-notes/{transcription_id}/process")
def process_voice_note(transcription_id: str, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    result = process_voice_transcription(
        org_id=org_id,
        transcription_id=transcription_id,
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=400,
            detail=result.get("message"),
        )

    return result


@router.post("/voice-notes/process-due")
def process_due_voice_notes(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return process_due_voice_transcriptions(
        org_id=org_id,
        limit=10,
    )
