from abc import ABC, abstractmethod

class WhatsAppProvider:
    def send_message(self, to: str, message: str) -> dict:
        raise NotImplementedError

    def send_media_message(
        self,
        to: str,
        message: str,
        media_url: str,
    ) -> dict:
        raise NotImplementedError

    def send_template_message(
        self,
        to: str,
        content_sid: str,
        content_variables: dict,
    ) -> dict:
        raise NotImplementedError
