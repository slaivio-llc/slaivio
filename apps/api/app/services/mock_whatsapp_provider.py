from app.services.whatsapp_provider import WhatsAppProvider


class MockWhatsAppProvider(WhatsAppProvider):
    def send_message(self, to: str, message: str) -> dict:
        print("=== MOCK WHATSAPP SEND ===")
        print("TO:", to)
        print("MESSAGE:", message)

        return {
            "success": True,
            "provider": "mock",
            "provider_message_id": "mock-" + to,
            "status": "sent",
        }

    def send_media_message(
        self,
        to: str,
        message: str,
        media_url: str,
    ) -> dict:
        print("=== MOCK WHATSAPP MEDIA SEND ===")
        print("TO:", to)
        print("MESSAGE:", message)
        print("MEDIA:", media_url)

        return {
            "success": True,
            "provider": "mock",
            "provider_message_id": "mock-media-" + to,
            "status": "sent",
            "media_url": media_url,
        }

    def send_template_message(
        self,
        to: str,
        content_sid: str,
        content_variables: dict,
    ) -> dict:
        print("=== MOCK WHATSAPP TEMPLATE SEND ===")
        print("TO:", to)
        print("CONTENT SID:", content_sid)
        print("VARIABLES:", content_variables)

        return {
            "success": True,
            "provider": "mock",
            "provider_message_id": "mock-template-" + to,
            "status": "sent",
        }
