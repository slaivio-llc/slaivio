import uuid
from datetime import datetime

from app.services.whatsapp_provider import WhatsAppProvider


class MockWhatsAppProvider(WhatsAppProvider):

    def send_message(
        self,
        to: str,
        message: str,
    ) -> dict:

        provider_message_id = f"mock-{uuid.uuid4()}"

        print("\n==============================")
        print("📤 MOCK WHATSAPP SEND")
        print("==============================")
        print("TIME:", datetime.utcnow().isoformat())
        print("TO:", to)
        print("------------------------------")
        print(message)
        print("------------------------------")
        print("PROVIDER MESSAGE ID:", provider_message_id)
        print("==============================\n")

        return {
            "success": True,
            "provider_message_id": provider_message_id,
        }
