from pydantic import BaseModel


class StartJourneyIn(BaseModel):
    journey_version: str = "v1"


class CompleteExperienceStepIn(BaseModel):
    step_key: str


class TrackOnboardingEventIn(BaseModel):
    step_key: str | None = None
    event_name: str
    payload: dict = {}


class ApplyTemplateIn(BaseModel):
    template_key: str
