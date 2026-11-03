"""Durable QR media work: tenant-scoped claims, bounded retries, no group replies."""
from sqlalchemy import text

from app.db.database import engine
from app.db.pilot_inbox_repository import effective_ai_mode, update_state
from app.ai.services.auto_reply_service import maybe_auto_reply_to_inbound_message
from app.services.dossier_document_storage import read_private_whatsapp_media
from app.services.inbox_media_understanding import understand_media, MAX_MEDIA_BYTES
from app.core.logger import logger


def _save(org_id, message_id, *, status, content=None, error=None, dispatched=False):
    with engine.begin() as conn:
        conn.execute(text("""update messages set media_analysis_status=:status,
          media_analysis_text=coalesce(:content,media_analysis_text),media_analysis_error=:error,
          media_analysis_dispatched=:dispatched
          where org_id=:org_id and id=cast(:message_id as uuid)"""), {
              "org_id": org_id, "message_id": message_id, "status": status,
              "content": content, "error": error, "dispatched": dispatched})


def process_media(org_id: str, message_id: str):
    with engine.begin() as conn:
        row = conn.execute(text("""update messages m set
          media_analysis_started_at=now(),media_analysis_attempts=media_analysis_attempts+1,
          media_analysis_status=case when media_analysis_text is null then 'PROCESSING' else 'COMPLETED' end
          where m.org_id=:org_id and m.id=cast(:message_id as uuid)
            and m.direction='inbound' and not coalesce(m.is_group,false)
            and m.provider='QR_LINKED_DEVICE' and m.message_type in('audio','ptt','image')
            and m.media_analysis_status in('PENDING','PROCESSING','COMPLETED')
            and not m.media_analysis_dispatched and m.media_analysis_attempts<3
            and (m.media_analysis_started_at is null or m.media_analysis_started_at<now()-interval '10 minutes')
            and exists(select 1 from ai_settings a where a.org_id=m.org_id
              and a.enabled and a.pilot_response_mode<>'PAUSED')
          returning m.*"""), {"org_id": org_id, "message_id": message_id}).mappings().first()
    if not row:
        return {"status": "skipped"}
    phone = row["from_phone"]
    try:
        if effective_ai_mode(org_id, phone) == "PAUSED":
            # Keep the file in the inbox; do not send it to the AI provider.
            _save(org_id, message_id, status="FAILED", error="paused", dispatched=True)
            return {"status": "skipped"}
        extracted = row.get("media_analysis_text")
        if not extracted:
            if not row.get("media_object_path"):
                raise ValueError("missing")
            content = read_private_whatsapp_media(org_id, row["media_object_path"], MAX_MEDIA_BYTES)
            extracted = understand_media(content, row.get("media_mime_type") or "")
            _save(org_id, message_id, status="COMPLETED", content=extracted)
        # Never send a delayed reply to an old attachment after a newer message.
        with engine.connect() as conn:
            latest = conn.execute(text("""select id::text from messages
              where org_id=:org_id and from_phone=:phone and direction='inbound'
              order by created_at desc limit 1"""), {"org_id": org_id, "phone": phone}).scalar()
        if latest == str(message_id):
            maybe_auto_reply_to_inbound_message(org_id, phone, extracted, row.get("number_role") or "SUPPORT",
                                               f"whatsapp:{row['dedupe_key']}")
        _save(org_id, message_id, status="COMPLETED", dispatched=True)
        return {"status": "completed"}
    except Exception as exc:
        # Neither file content, provider error bodies nor credentials in logs/UI.
        safe = str(exc) if isinstance(exc, ValueError) and str(exc) in {
            "too_large", "too_long", "unreadable", "unsupported", "unsafe", "missing"
        } else "unavailable"
        terminal = safe != "unavailable" or row["media_analysis_attempts"] >= 3
        _save(org_id, message_id, status="FAILED" if terminal else "PENDING", error=safe, dispatched=terminal)
        update_state(org_id, phone, "OPEN", True, "pilot-ai")
        logger.warning("inbox_media_analysis_failed reason=%s", safe)
        return {"status": "failed", "reason": safe}


def process_pending_media(limit: int = 20):
    # System cron only. Each claimed message is still matched by its own tenant.
    with engine.begin() as conn:
        conn.execute(text("""update messages set media_analysis_status='FAILED',
          media_analysis_error='unavailable',media_analysis_dispatched=true
          where media_analysis_status in('PENDING','PROCESSING','COMPLETED')
            and not media_analysis_dispatched and media_analysis_attempts>=3
            and media_analysis_started_at<now()-interval '10 minutes'"""))
    with engine.connect() as conn:
        jobs = conn.execute(text("""select org_id,id::text id from messages m
          where media_analysis_status in('PENDING','PROCESSING','COMPLETED')
            and not media_analysis_dispatched and media_analysis_attempts<3
            and (media_analysis_started_at is null or media_analysis_started_at<now()-interval '10 minutes')
            and exists(select 1 from ai_settings a where a.org_id=m.org_id
              and a.enabled and a.pilot_response_mode<>'PAUSED')
          order by created_at limit :limit"""), {"limit": min(max(limit, 1), 100)}).mappings().all()
    return [process_media(row["org_id"], row["id"]) for row in jobs]
