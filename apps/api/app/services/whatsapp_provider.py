from abc import ABC, abstractmethod


class WhatsAppProvider(ABC):

    @abstractmethod
    def send_message(
        self,
        to: str,
        message: str,
    ) -> dict:
        """
        Send WhatsApp message.

        Returns:
        {
            "success": bool,
            "provider_message_id": str | None,
            "error": str | None,
        }
        """
        pass
