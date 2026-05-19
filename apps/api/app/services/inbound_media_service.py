from app.db.media_repository import create_shipment_media
from app.db.message_repository import create_dossier_event
from app.services.voice_note_service import create_voice_transcription_job
from app.services.meta_media_service import retrieve_meta_media_url


def store_inbound_twilio_media(
    org_id: str,
    client_id: str,
    dossier_id: str,
    shipment_id: str | None,
    provider_message_id: str | None,
    media_items: list[dict],
    raw_payload: dict,
):
    stored = []

    for item in media_items:
        media = create_shipment_media(
            org_id=org_id,
            shipment_id=shipment_id,
            dossier_id=dossier_id,
            client_id=client_id,
            media_url=item["media_url"],
            media_type=item["media_type"],
            caption="Média reçu via WhatsApp",
            is_private=True,
            provider="twilio",
            provider_media_url=item["media_url"],
            provider_message_id=provider_message_id,
            content_type=item.get("content_type"),
            direction="INBOUND",
            source_channel="whatsapp",
            raw_payload=raw_payload,
        )

        if media:
            stored.append(media)
            if item.get("is_audio"):
                create_voice_transcription_job(
                    org_id=org_id,
                    client_id=client_id,
                    dossier_id=dossier_id,
                    shipment_id=shipment_id,
                    media_id=str(media["id"]),
                    provider_message_id=provider_message_id,
                    media_url=item["media_url"],
                    content_type=item.get("content_type"),
                )


    if stored:
        create_dossier_event(
            org_id=org_id,
            dossier_id=dossier_id,
            event_type="INBOUND_MEDIA_STORED",
            payload={
                "count": len(stored),
                "media_ids": [str(media["id"]) for media in stored],
                "provider_message_id": provider_message_id,
            },
        )

    return stored

def store_inbound_infobip_media(
    org_id: str,
    client_id: str,
    dossier_id: str,
    shipment_id: str | None,
    media_items: list[dict],
    raw_payload: dict,
):
    stored = []

    for item in media_items:
        media = create_shipment_media(
            org_id=org_id,
            shipment_id=shipment_id,
            dossier_id=dossier_id,
            client_id=client_id,
            media_url=item["media_url"],
            media_type=item["media_type"],
            caption=item.get("caption") or "Média reçu via WhatsApp",
            is_private=True,
            provider="infobip",
            provider_media_url=item["media_url"],
            provider_message_id=item.get("provider_message_id"),
            content_type=item.get("content_type"),
            direction="INBOUND",
            source_channel="whatsapp",
            raw_payload=item.get("raw") or raw_payload,
        )

        if media:
            stored.append(media)

    if stored:
        create_dossier_event(
            org_id=org_id,
            dossier_id=dossier_id,
            event_type="INFOBIP_INBOUND_MEDIA_STORED",
            payload={
                "count": len(stored),
                "media_ids": [str(media["id"]) for media in stored],
            },
        )

    return stored

def store_inbound_meta_media(
    org_id: str,
    client_id: str,
    dossier_id: str,
    shipment_id: str | None,
    media_items: list[dict],
    raw_payload: dict,
    phone_number_id: str | None = None,
):
    stored = []

    for item in media_items:
        media_url = None

        try:
            media_info = retrieve_meta_media_url(
                media_id=item["provider_media_id"],
                phone_number_id=phone_number_id,
            )

            media_url = media_info.get("url")

        except Exception:
            media_url = f"meta-media-id:{item['provider_media_id']}"

        media = create_shipment_media(
            org_id=org_id,
            shipment_id=shipment_id,
            dossier_id=dossier_id,
            client_id=client_id,
            media_url=media_url,
            media_type=item["media_type"],
            caption=item.get("caption") or "Média reçu via WhatsApp",
            is_private=True,
            provider="meta",
            provider_media_url=media_url,
            provider_message_id=item.get("provider_message_id"),
            content_type=item.get("content_type"),
            direction="INBOUND",
            source_channel="whatsapp",
            raw_payload=item.get("raw") or raw_payload,
        )

        if media:
            stored.append(media)

    if stored:
        create_dossier_event(
            org_id=org_id,
            dossier_id=dossier_id,
            event_type="META_INBOUND_MEDIA_STORED",
            payload={
                "count": len(stored),
                "media_ids": [str(media["id"]) for media in stored],
            },
        )

    return stored
