import json
from datetime import datetime, timezone
from uuid import uuid4

from app.onboarding.repositories.onboarding_repository import _json


def test_onboarding_audit_payload_serializes_database_values():
    profile_id = uuid4()
    updated_at = datetime.now(timezone.utc)

    payload = json.loads(_json({"profile_id": profile_id, "updated_at": updated_at}))

    assert payload == {
        "profile_id": str(profile_id),
        "updated_at": str(updated_at),
    }
