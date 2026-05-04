from fastapi import APIRouter
from pydantic import BaseModel

from app.db.office_repository import (
    create_office,
    list_offices,
    find_office,
)

router = APIRouter()


class CreateOfficeRequest(BaseModel):
    country: str
    city: str
    address: str
    office_type: str = "OFFICE"
    phone: str | None = None
    whatsapp: str | None = None
    opening_hours: str | None = None
    pickup_instructions: str | None = None


@router.post("/offices")
def create_agency_office(body: CreateOfficeRequest):
    office = create_office(
        org_id="demo_agency",
        country=body.country,
        city=body.city,
        address=body.address,
        office_type=body.office_type,
        phone=body.phone,
        whatsapp=body.whatsapp,
        opening_hours=body.opening_hours,
        pickup_instructions=body.pickup_instructions,
    )

    return {
        "status": "ok",
        "office": office,
    }


@router.get("/offices")
def get_offices(
    country: str | None = None,
    city: str | None = None,
    office_type: str | None = None,
):
    offices = list_offices(
        org_id="demo_agency",
        country=country,
        city=city,
        office_type=office_type,
    )

    return {
        "status": "ok",
        "count": len(offices),
        "offices": offices,
    }


@router.get("/offices/search")
def search_office(
    country: str | None = None,
    city: str | None = None,
    office_type: str | None = None,
):
    office = find_office(
        org_id="demo_agency",
        country=country,
        city=city,
        office_type=office_type,
    )

    return {
        "status": "ok",
        "office": office,
    }