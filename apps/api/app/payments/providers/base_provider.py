from abc import ABC, abstractmethod


class PaymentProvider(ABC):
    @abstractmethod
    def create_payment_request(
        self,
        amount_minor: int,
        currency_code: str,
        customer_phone: str,
        description: str | None = None,
    ):
        raise NotImplementedError


    @abstractmethod
    def check_payment_status(
        self,
        provider_reference: str,
    ):
        raise NotImplementedError

