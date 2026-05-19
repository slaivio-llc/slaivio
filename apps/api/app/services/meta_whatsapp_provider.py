import requests

from app.core.config import settings
from app.services.whatsapp_provider import WhatsAppProvider
from app.db.organization_whatsapp_repository import get_active_whatsapp_settings


class MetaWhatsAppProvider(WhatsAppProvider):
    def __init__(self, org_id: str | None = None):
        if not settings.meta_wa_access_token:
            raise ValueError("META_WA_ACCESS_TOKEN is missing")

        self.access_token = settings.meta_wa_access_token
        self.api_version = settings.meta_wa_api_version

        org_settings = None

        if org_id:
            org_settings = get_active_whatsapp_settings(
                org_id=org_id,
                provider="meta",
            )

        if not org_settings:
            raise ValueError("No Meta WhatsApp settings configured for organization")

        phone_number_id = org_settings.get("meta_phone_number_id")

        if not phone_number_id:
            raise ValueError("meta_phone_number_id missing for organization")

        self.phone_number_id = phone_number_id

    def build_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def send_message(self, to: str, message: str) -> dict:
        url = (
            f"https://graph.facebook.com/"
            f"{self.api_version}/"
            f"{self.phone_number_id}/messages"
        )

        payload = {
            "messaging_product": "whatsapp",
            "to": to.replace("+", "").replace(" ", ""),
            "type": "text",
            "text": {
                "body": message,
            },
        }

        response = requests.post(
            url,
            headers=self.build_headers(),
            json=payload,
            timeout=30,
        )

        data = response.json()

        success = response.status_code < 300

        provider_message_id = None

        messages = data.get("messages") or []

        if messages:
            provider_message_id = messages[0].get("id")

        return {
            "success": success,
            "provider": "meta",
            "provider_message_id": provider_message_id,
            "status": "accepted" if success else "failed",
            "response": data,
        }

    def send_media_message(
        self,
        to: str,
        message: str,
        media_url: str,
    ) -> dict:
        url = (
            f"https://graph.facebook.com/"
            f"{self.api_version}/"
            f"{self.phone_number_id}/messages"
        )

        payload = {
            "messaging_product": "whatsapp",
            "to": to.replace("+", "").replace(" ", ""),
            "type": "image",
            "image": {
                "link": media_url,
                "caption": message,
            },
        }

        response = requests.post(
            url,
            headers=self.build_headers(),
            json=payload,
            timeout=30,
        )

        data = response.json()
        success = response.status_code < 300

        provider_message_id = None

        messages = data.get("messages") or []

        if messages:
            provider_message_id = messages[0].get("id")

        return {
            "success": success,
            "provider": "meta",
            "provider_message_id": provider_message_id,
            "status": "accepted" if success else "failed",
            "response": data,
        }

    def send_template_message(
        self,
        to: str,
        content_sid: str,
        content_variables: dict,
    ) -> dict:
        raise NotImplementedError("Meta template support in 1.C.16")
