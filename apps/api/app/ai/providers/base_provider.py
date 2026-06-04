from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    @abstractmethod
    def generate(
        self,
        messages: list[dict],
        model_name: str,
        temperature: float,
        max_tokens: int,
    ) -> dict:
        pass

