import json
from datetime import datetime, timezone
from uuid import uuid4

from app.onboarding.repositories.onboarding_repository import _json as legacy_onboarding_json
from app.onboarding_experience.repositories.onboarding_experience_repository import _json as experience_json


def test_all_onboarding_audit_payloads_serialize_database_values():
    profile_id = uuid4()
    updated_at = datetime.now(timezone.utc)
    expected = {
        "profile_id": str(profile_id),
        "updated_at": str(updated_at),
    }

    legacy_payload = json.loads(legacy_onboarding_json({"profile_id": profile_id, "updated_at": updated_at}))
    experience_payload = json.loads(experience_json({"profile_id": profile_id, "updated_at": updated_at}))

    assert legacy_payload == expected
    assert experience_payload == expected
