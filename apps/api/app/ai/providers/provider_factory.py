from app.ai.providers.mistral_provider import MistralProvider


def get_provider(provider_name: str):
    if provider_name == "MISTRAL":
        return MistralProvider()

    raise ValueError(f"Unsupported AI provider: {provider_name}")

