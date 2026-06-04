import requests

from app.ai.providers.base_provider import BaseLLMProvider
from app.core.config import settings
from app.core.logger import logger


MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"


class MistralProvider(BaseLLMProvider):
    def generate(
        self,
        messages: list[dict],
        model_name: str,
        temperature: float,
        max_tokens: int,
    ) -> dict:
        api_key = settings.mistral_api_key

        if not api_key:
            return {
                "success": False,
                "error": "MISTRAL_API_KEY is missing",
            }

        try:
            response = requests.post(
                MISTRAL_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=45,
            )
            data = response.json()
        except requests.Timeout:
            logger.error("mistral_timeout")
            return {
                "success": False,
                "error": "mistral_timeout",
            }
        except Exception as exc:
            logger.exception("mistral_error")
            return {
                "success": False,
                "error": str(exc),
            }

        if not response.ok:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": data,
            }

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content")
        )

        return {
            "success": True,
            "provider": "MISTRAL",
            "model": model_name,
            "content": content,
            "raw": data,
        }

