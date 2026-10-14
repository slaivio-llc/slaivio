from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.organization_admin import repository as organization_repository
from app.db.office_repository import (
    list_offices,
    find_office,
)


router = APIRouter()


class CreateOfficeRequest(BaseModel):
    country: str
    city: str
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    opening_hours: str | None = None


@router.post("/offices")
def create_agency_office(
    body: CreateOfficeRequest,
    tenant=Depends(get_current_tenant),
    _permission=Depends(require_permission("locations.manage")),
):
    org_id = tenant["org_id"]

    office = organization_repository.save_location(
        org_id=org_id,
        actor=tenant["user_id"],
        data={
            "name": body.name or f"{body.city} — {body.country}",
            "code": None,
            "location_type": "OFFICE",
            "country": body.country,
            "city": body.city,
            "address": body.address,
            "phone": body.phone,
            "whatsapp": body.whatsapp,
            "opening_hours": {"text": body.opening_hours} if body.opening_hours else {},
            "timezone": "UTC",
            "services": [],
        },
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
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    offices = list_offices(
        org_id=org_id,
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
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    office = find_office(
        org_id=org_id,
        country=country,
        city=city,
        office_type=office_type,
    )

    return {
        "status": "ok",
        "office": office,
    }
