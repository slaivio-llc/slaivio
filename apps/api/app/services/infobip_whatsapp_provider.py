import requests

from app.core.config import settings

from app.services.whatsapp_provider import WhatsAppProvider

from app.db.organization_whatsapp_repository import (
    get_active_whatsapp_settings,
)


class InfobipWhatsAppProvider(WhatsAppProvider):
    def __init__(self, org_id: str | None = None):
        self.base_url = settings.infobip_base_url.rstrip("/")

        self.api_key = settings.infobip_api_key

        if not self.base_url:
            raise ValueError("INFOBIP_BASE_URL missing")

        if not self.api_key:
            raise ValueError("INFOBIP_API_KEY missing")

        org_settings = None

        if org_id:
            org_settings = get_active_whatsapp_settings(
                org_id=org_id,
                provider="infobip",
            )

        self.org_settings = org_settings

        from_number = None

        if org_settings:
            from_number = org_settings.get(
                "infobip_whatsapp_from"
            )

        if not from_number:
            raise ValueError(
                "No Infobip sender configured"
            )

        self.from_number = from_number

    def build_headers(self):
        return {
            "Authorization": f"App {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def send_message(
        self,
        to: str,
        message: str,
    ) -> dict:
        url = f"{self.base_url}/whatsapp/1/message/text"

        payload = {
            "from": self.from_number,
            "to": to,
            "content": {
                "text": message,
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

        message_id = None
        status = None

        results = data.get("messages") or []

        if results:
            message_id = results[0].get("messageId")

            status_obj = results[0].get("status") or {}

            status = status_obj.get("groupName")

        return {
            "success": success,
            "provider": "infobip",
            "provider_message_id": message_id,
            "status": status,
            "response": data,
        }

    def send_media_message(
        self,
        to: str,
        message: str,
        media_url: str,
        media_type: str = "image",
    ) -> dict:
        media_type = media_type.lower()

        endpoint_by_type = {
            "image": "image",
            "photo": "image",
            "document": "document",
            "video": "video",
            "audio": "audio",
        }

        endpoint = endpoint_by_type.get(media_type, "image")

        url = f"{self.base_url}/whatsapp/1/message/{endpoint}"

        content = {
            "mediaUrl": media_url,
        }

        if endpoint == "image":
            content["caption"] = message

        elif endpoint == "document":
            content["caption"] = message
            content["filename"] = "slaivo-document"

        elif endpoint == "video":
            content["caption"] = message

        payload = {
            "from": self.from_number,
            "to": to,
            "content": content,
        }

        response = requests.post(
            url,
            headers=self.build_headers(),
            json=payload,
            timeout=30,
        )

        data = response.json()
        success = response.status_code < 300

        message_id = None
        status = None

        results = data.get("messages") or []

        if results:
            message_id = results[0].get("messageId")
            status_obj = results[0].get("status") or {}
            status = status_obj.get("groupName")

        return {
            "success": success,
            "provider": "infobip",
            "provider_message_id": message_id,
            "status": status,
            "response": data,
        }


    def send_template_message(
        self,
        to: str,
        content_sid: str,
        content_variables: dict,
    ) -> dict:
        url = f"{self.base_url}/whatsapp/1/message/template"

        payload = {
            "messages": [
                {
                    "from": self.from_number,
                    "to": to,
                    "content": {
                        "templateName": content_sid,
                        "templateData": {
                            "body": {
                                "placeholders": [
                                    str(value)
                                    for value in content_variables.values()
                                ]
                            }
                        },
                        "language": content_variables.get("_language", "fr")
                    }
                }
            ]
        }

        response = requests.post(
            url,
            headers=self.build_headers(),
            json=payload,
            timeout=30,
        )

        data = response.json()
        success = response.status_code < 300

        message_id = None
        status = None

        messages = data.get("messages") or []

        if messages:
            message_id = messages[0].get("messageId")
            status_obj = messages[0].get("status") or {}
            status = status_obj.get("groupName")

        return {
            "success": success,
            "provider": "infobip",
            "provider_message_id": message_id,
            "status": status,
            "response": data,
            "template_name": content_sid,
        }

