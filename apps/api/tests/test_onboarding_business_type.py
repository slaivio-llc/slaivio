import pytest
from pydantic import ValidationError

from app.onboarding.schemas.onboarding_schemas import AgencyProfileIn


def payload(business_type: str) -> dict:
    return {
        "brand_name": "Luza Services",
        "country": "CD",
        "business_type": business_type,
    }


@pytest.mark.parametrize("business_type", ["VEHICLE_IMPORT", "PARCEL_FREIGHT"])
def test_agency_profile_accepts_the_two_product_surfaces(business_type):
    assert AgencyProfileIn(**payload(business_type)).business_type == business_type


def test_agency_profile_rejects_legacy_hybrid_choices():
    with pytest.raises(ValidationError):
        AgencyProfileIn(**payload("HYBRID"))
