from sqlalchemy import text

from app.db.database import engine


ALLOWED_MEDIA_TYPES = {
    "PHOTO",
    "VIDEO",
    "WEIGHT_PROOF",
    "ARRIVAL_PROOF",
    "PICKUP_PROOF",
    "DELIVERY_PROOF",
    "VOICE_NOTE",

}


def create_shipment_media(
    org_id: str,
    shipment_id: str | None,
    dossier_id: str | None,
    client_id: str | None,
    media_url: str,
    media_type: str = "PHOTO",
    caption: str | None = None,
    public_note: str | None = None,
    internal_note: str | None = None,
    uploaded_by: str | None = None,
    is_private: bool = True,
    provider: str | None = None,
    provider_media_url: str | None = None,
    provider_message_id: str | None = None,
    content_type: str | None = None,
    direction: str = "INBOUND",
    source_channel: str = "whatsapp",
    raw_payload: dict | None = None,
):
    import json

    normalized_media_type = media_type.strip().upper()

    if normalized_media_type not in ALLOWED_MEDIA_TYPES:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into shipment_media (
                    org_id,
                    shipment_id,
                    dossier_id,
                    client_id,
                    media_type,
                    media_url,
                    caption,
                    public_note,
                    internal_note,
                    uploaded_by,
                    is_private,
                    provider,
                    provider_media_url,
                    provider_message_id,
                    content_type,
                    direction,
                    source_channel,
                    raw_payload
                )
                values (
                    :org_id,
                    :shipment_id,
                    :dossier_id,
                    :client_id,
                    :media_type,
                    :media_url,
                    :caption,
                    :public_note,
                    :internal_note,
                    :uploaded_by,
                    :is_private,
                    :provider,
                    :provider_media_url,
                    :provider_message_id,
                    :content_type,
                    :direction,
                    :source_channel,
                    CAST(:raw_payload AS jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "dossier_id": dossier_id,
                "client_id": client_id,
                "media_type": normalized_media_type,
                "media_url": media_url,
                "caption": caption,
                "public_note": public_note,
                "internal_note": internal_note,
                "uploaded_by": uploaded_by,
                "is_private": is_private,
                "provider": provider,
                "provider_media_url": provider_media_url,
                "provider_message_id": provider_message_id,
                "content_type": content_type,
                "direction": direction.strip().upper(),
                "source_channel": source_channel,
                "raw_payload": json.dumps(raw_payload or {}),
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None



def list_shipment_media(
    org_id: str,
    shipment_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from shipment_media
                where org_id = :org_id
                  and shipment_id = :shipment_id
                  and is_active = true
                order by created_at desc
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def list_dossier_media(
    org_id: str,
    dossier_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from shipment_media
                where org_id = :org_id
                  and dossier_id = :dossier_id
                  and is_active = true
                order by created_at desc
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_media_item(
    org_id: str,
    media_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from shipment_media
                where org_id = :org_id
                  and id = :media_id
                limit 1
            """),
            {
                "org_id": org_id,
                "media_id": media_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def deactivate_media_item(
    org_id: str,
    media_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipment_media
                set is_active = false
                where org_id = :org_id
                  and id = :media_id
                returning *
            """),
            {
                "org_id": org_id,
                "media_id": media_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
