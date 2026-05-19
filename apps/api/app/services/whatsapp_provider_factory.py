from app.core.config import settings
from app.services.mock_whatsapp_provider import MockWhatsAppProvider
from app.services.twilio_whatsapp_provider import TwilioWhatsAppProvider
from app.services.meta_whatsapp_provider import MetaWhatsAppProvider



def get_whatsapp_provider():
    provider = settings.whatsapp_provider.strip().lower()

    if provider == "meta":
        return MetaWhatsAppProvider(org_id=org_id)
    

    return MockWhatsAppProvider()
