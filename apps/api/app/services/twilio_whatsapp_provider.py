from twilio.rest import Client

from app.core.config import settings
from app.services.whatsapp_provider import WhatsAppProvider


class TwilioWhatsAppProvider(WhatsAppProvider):
    def __init__(self):
        if not settings.twilio_account_sid:
            raise ValueError("TWILIO_ACCOUNT_SID is missing")

        if not settings.twilio_auth_token:
            raise ValueError("TWILIO_AUTH_TOKEN is missing")

        if not settings.twilio_whatsapp_from:
            raise ValueError("TWILIO_WHATSAPP_FROM is missing")

        self.client = Client(
            settings.twilio_account_sid,
            settings.twilio_auth_token,
        )

        self.from_number = settings.twilio_whatsapp_from

    def normalize_to(self, phone: str) -> str:
        if phone.startswith("whatsapp:"):
            return phone

        return f"whatsapp:{phone}"

    def get_status_callback_url(self) -> str | None:
        if not settings.public_base_url:
            return None

        return (
            settings.public_base_url.rstrip("/")
            + settings.twilio_status_callback_path
        )

    def send_message(self, to: str, message: str) -> dict:
        kwargs = {
            "from_": self.from_number,
            "to": self.normalize_to(to),
            "body": message,
        }

        status_callback_url = self.get_status_callback_url()

        if status_callback_url:
            kwargs["status_callback"] = status_callback_url

        result = self.client.messages.create(**kwargs)

        return {
            "success": True,
            "provider": "twilio",
            "provider_message_id": result.sid,
            "status": result.status,
            "to": result.to,
            "from": result.from_,
            "status_callback_url": status_callback_url,
        }

    def send_media_message(
        self,
        to: str,
        message: str,
        media_url: str,
    ) -> dict:
        kwargs = {
            "from_": self.from_number,
            "to": self.normalize_to(to),
            "body": message,
            "media_url": [media_url],
        }

        status_callback_url = self.get_status_callback_url()

        if status_callback_url:
            kwargs["status_callback"] = status_callback_url

        result = self.client.messages.create(**kwargs)

        return {
            "success": True,
            "provider": "twilio",
            "provider_message_id": result.sid,
            "status": result.status,
            "to": result.to,
            "from": result.from_,
            "media_url": media_url,
            "status_callback_url": status_callback_url,
        }

    def send_template_message(
        self,
        to: str,
        content_sid: str,
        content_variables: dict,
    ) -> dict:
        import json

        kwargs = {
            "to": self.normalize_to(to),
            "content_sid": content_sid,
            "content_variables": json.dumps(content_variables),
        }

        if settings.twilio_messaging_service_sid:
            kwargs["messaging_service_sid"] = settings.twilio_messaging_service_sid
        else:
            kwargs["from_"] = self.from_number

        status_callback_url = self.get_status_callback_url()

        if status_callback_url:
            kwargs["status_callback"] = status_callback_url

        result = self.client.messages.create(**kwargs)

        return {
            "success": True,
            "provider": "twilio",
            "provider_message_id": result.sid,
            "status": result.status,
            "to": result.to,
            "from": getattr(result, "from_", None),
            "content_sid": content_sid,
            "status_callback_url": status_callback_url,
        }
