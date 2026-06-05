from uuid import uuid4

from app.payments.providers.base_provider import PaymentProvider


class MockPaymentProvider(PaymentProvider):
    def create_payment_request(
        self,
        amount_minor: int,
        currency_code: str,
        customer_phone: str,
        description: str | None = None,
    ):
        provider_reference = f"MOCK-{str(uuid4())[:10].upper()}"

        return {
            "ok": True,
            "provider_reference": provider_reference,
            "status": "PENDING",
            "raw_response": {
                "provider_reference": provider_reference,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "customer_phone": customer_phone,
                "description": description,
            },
        }


    def check_payment_status(
        self,
        provider_reference: str,
    ):
        return {
            "ok": True,
            "provider_reference": provider_reference,
            "status": "SUCCEEDED",
            "raw_response": {
                "provider_reference": provider_reference,
                "status": "SUCCEEDED",
            },
        }

