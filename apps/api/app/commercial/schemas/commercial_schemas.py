from pydantic import BaseModel


class CommercialMessageRequest(BaseModel):
    phone: str
    message: str
    source_channel: str = "whatsapp"


class QuoteRequestIn(BaseModel):
    phone: str | None = None
    client_id: str | None = None
    origin_country: str | None = None
    origin_city: str | None = None
    destination_country: str | None = None
    destination_city: str | None = None
    goods_description: str | None = None
    goods_category: str | None = None
    weight_kg: float | None = None
    volume_cbm: float | None = None
    quantity: int | None = None
    shipping_mode: str | None = None
    requested_currency: str | None = None
    requested_eta: str | None = None


class ProcurementRequestIn(BaseModel):
    phone: str | None = None
    client_id: str | None = None
    product_description: str
    target_country: str | None = None
    destination_country: str | None = None
    budget_minor: int | None = None
    currency_code: str | None = None
    quantity: int | None = None
    quality_requirements: str | None = None


class RestrictionCheckRequestIn(BaseModel):
    phone: str | None = None
    client_id: str | None = None
    goods_description: str
    goods_category: str | None = None
    origin_country: str | None = None
    destination_country: str | None = None
    shipping_mode: str | None = None
