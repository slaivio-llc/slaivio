from fastapi import APIRouter
from pydantic import BaseModel
from app.services.pricing_engine import calculate_price


router = APIRouter()

ORG_ID = "demo_agency"


class PricingRequest(BaseModel):
    origin_country: str
    destination_country: str
    weight_kg: float | None = None
    volume_cbm: float | None = None
    goods_type: str | None = None


@router.post("/pricing/calculate")
def pricing(body: PricingRequest):
    result = calculate_price(
        org_id=ORG_ID,
        origin_country=body.origin_country,
        destination_country=body.destination_country,
        weight_kg=body.weight_kg,
        volume_cbm=body.volume_cbm,
        goods_type=body.goods_type,
    )

    return {
        "status": "ok",
        "result": result,
    }
