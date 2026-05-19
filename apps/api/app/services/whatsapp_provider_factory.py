from app.core.config import settings
from app.services.mock_whatsapp_provider import MockWhatsAppProvider
from app.services.meta_whatsapp_provider import MetaWhatsAppProvider


def get_whatsapp_provider(org_id: str | None = None):
    provider = settings.whatsapp_provider

    if provider == "meta":
        return MetaWhatsAppProvider(org_id=org_id)

    if provider == "mock":
        return MockWhatsAppProvider()

    return MockWhatsAppProvider()