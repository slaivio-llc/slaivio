import pytest
from pydantic import ValidationError

from app.onboarding.schemas.onboarding_schemas import AgencyProfileIn


def payload(business_type: str | None = "PARCEL_FREIGHT") -> dict:
    result = {
        "brand_name": "Luza Services",
        "country": "CD",
    }
    if business_type is not None:
        result["business_type"] = business_type
    return result


def test_agency_profile_defaults_to_parcel_freight():
    assert AgencyProfileIn(**payload("PARCEL_FREIGHT")).business_type == "PARCEL_FREIGHT"
    assert AgencyProfileIn(**payload(None)).business_type == "PARCEL_FREIGHT"


@pytest.mark.parametrize("business_type", ["VEHICLE_IMPORT", "HYBRID"])
def test_agency_profile_rejects_retired_product_surfaces(business_type):
    with pytest.raises(ValidationError):
        AgencyProfileIn(**payload(business_type))
