from app.services.whatsapp_provider import WhatsAppProvider


class MockWhatsAppProvider(WhatsAppProvider):
    def send_message(self, to: str, message: str) -> dict:
        print("=== MOCK WHATSAPP SEND ===")
        print("TO:", to)
        print("MESSAGE:", message)

        return {
            "success": True,
            "provider_message_id": "mock-" + to
        }