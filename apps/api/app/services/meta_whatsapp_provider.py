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

    def build_messages_url(self) -> str:
        return (
            f"https://graph.facebook.com/"
            f"{self.api_version}/"
            f"{self.phone_number_id}/messages"
        )

    def send_message(self, to: str, message: str) -> dict:
        payload = {
            "messaging_product": "whatsapp",
            "to": self.normalize_to(to),
            "type": "text",
            "text": {
                "body": message,
            },
        }

        return self._post_message(payload)

    def send_media_message(
        self,
        to: str,
        message: str,
        media_url: str,
        media_type: str = "image",
    ) -> dict:
        media_type = media_type.lower()

        if media_type in {"photo", "image"}:
            wa_type = "image"
            content = {
                "link": media_url,
                "caption": message,
            }

        elif media_type == "document":
            wa_type = "document"
            content = {
                "link": media_url,
                "caption": message,
                "filename": "slaivo-document",
            }

        elif media_type == "video":
            wa_type = "video"
            content = {
                "link": media_url,
                "caption": message,
            }

        elif media_type == "audio":
            wa_type = "audio"
            content = {
                "link": media_url,
            }

        else:
            wa_type = "image"
            content = {
                "link": media_url,
                "caption": message,
            }

        payload = {
            "messaging_product": "whatsapp",
            "to": self.normalize_to(to),
            "type": wa_type,
            wa_type: content,
        }

        return self._post_message(payload)

    def send_template_message(
        self,
        to: str,
        content_sid: str,
        content_variables: dict,
    ) -> dict:
        language = content_variables.get("_language", "fr")

        components = []

        placeholders = [
            str(value)
            for key, value in content_variables.items()
            if not str(key).startswith("_")
        ]

        if placeholders:
            components.append({
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "text": value,
                    }
                    for value in placeholders
                ],
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": self.normalize_to(to),
            "type": "template",
            "template": {
                "name": content_sid,
                "language": {
                    "code": language,
                },
                "components": components,
            },
        }

        return self._post_message(payload)

    def send_media_template_message(
        self,
        to: str,
        template_name: str,
        language: str,
        media_url: str,
        body_variables: list[str] | None = None,
        media_type: str = "image",
    ) -> dict:
        media_type = media_type.lower()

        header_type = "image"

        if media_type == "document":
            header_type = "document"

        if media_type == "video":
            header_type = "video"

        components = [
            {
                "type": "header",
                "parameters": [
                    {
                        "type": header_type,
                        header_type: {
                            "link": media_url,
                        },
                    }
                ],
            }
        ]

        if body_variables:
            components.append({
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "text": str(value),
                    }
                    for value in body_variables
                ],
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": self.normalize_to(to),
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language,
                },
                "components": components,
            },
        }

        return self._post_message(payload)

    def _post_message(self, payload: dict) -> dict:
        response = requests.post(
            self.build_messages_url(),
            headers=self.build_headers(),
            json=payload,
            timeout=30,
        )

        try:
            data = response.json()
        except Exception:
            data = {
                "raw": response.text,
            }

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

    def normalize_to(self, value: str) -> str:
        return (
            value
            .replace("whatsapp:", "")
            .replace("+", "")
            .replace(" ", "")
        )
