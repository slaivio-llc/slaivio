from pydantic import BaseModel


class AgencyProfileIn(BaseModel):
    legal_name: str | None = None
    brand_name: str
    country: str
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    default_language: str | None = None
    default_currency: str | None = None
    business_type: str | None = None


class CompleteStepIn(BaseModel):
    step_key: str


class OnboardingStatusOut(BaseModel):
    status: str
    current_step: str
    completed_steps: list[str]
    missing_steps: list[str]
