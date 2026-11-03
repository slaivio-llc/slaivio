import json
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from psycopg2.extensions import adapt

from app.api.broadcasts import Campaign, Consent, Template
from app.db import broadcast_repository as repo


def connection_for(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repo, "engine", engine)
    connection = engine.begin.return_value.__enter__.return_value
    connection.execute.return_value.scalar.return_value = "Africa/Kinshasa"
    connection.execute.return_value.mappings.return_value.one.return_value = {
        "id": "record-id", "org_id": "agency",
    }
    return connection


def insert_parameters(connection, table):
    calls = [call for call in connection.execute.call_args_list
             if str(call.args[0]).startswith(f"insert into {table}(")]
    assert len(calls) == 1
    statement, params = calls[0].args
    # Exercise psycopg2 adaptation for every actual SQL bind, not just JSON.
    # Raw dicts raise the exact ProgrammingError seen in production here.
    for name in statement.compile().params:
        adapt(params[name]).getquoted()
    assert params["o"] == "agency"
    return params


@pytest.mark.parametrize("populated", [False, True])
@pytest.mark.parametrize("scheduled_at", [None, "2026-11-05T15:30"])
def test_campaign_encodes_json_after_merging_model_fields(monkeypatch, populated, scheduled_at):
    connection = connection_for(monkeypatch)
    options = {
        "language_versions": {"en": {"message": "Tomorrow's departure"}},
        "media": [{"url": "https://example.com/departure.pdf", "type": "document"}],
        "variable_defaults": {"client_name": "Équipe"},
        "selected_client_ids": ["b9a7ebf1-8082-49e1-a520-b9ad93b70c18"],
    } if populated else {}
    data = Campaign(title="Départ demain", message="Bonjour {{client_name}}",
                    scheduled_at=scheduled_at, **options).model_dump()
    original = deepcopy(data)

    result = repo.create_campaign("agency", "actor", data)

    params = insert_parameters(connection, "broadcasts")
    for field in ("language_versions", "media", "selected_client_ids"):
        assert isinstance(params[field], str)
        assert json.loads(params[field]) == data[field]
    assert json.loads(params["defaults"]) == data["variable_defaults"]
    assert params["channels"] == ["WHATSAPP"]  # PostgreSQL array, not JSON.
    assert params["a"] == "actor"
    assert params["status"] == ("SCHEDULED" if scheduled_at else "DRAFT")
    assert params["scheduled_at"] == (
        datetime(2026, 11, 5, 14, 30, tzinfo=timezone.utc) if scheduled_at else None
    )
    assert result == {"id": "record-id", "org_id": "agency"}
    event = insert_parameters(connection, "broadcast_events")
    assert event["e"] == "CAMPAIGN_CREATED"
    assert json.loads(event["p"]) == result
    assert data == original


@pytest.mark.parametrize("populated", [False, True])
def test_template_encodes_json_but_keeps_variables_as_array(monkeypatch, populated):
    connection = connection_for(monkeypatch)
    options = {
        "media_config": {"type": "image", "url": "https://example.com/image.png"},
        "buttons": [{"type": "URL", "text": "Suivre", "url": "https://example.com"}],
    } if populated else {}
    data = Template(name="Départ", body="Bonjour {{client_name}}",
                    variables=["client_name"], **options).model_dump()

    repo.save_template("agency", "actor", data)

    params = insert_parameters(connection, "broadcast_templates")
    for field in ("media_config", "buttons"):
        assert isinstance(params[field], str)
        assert json.loads(params[field]) == data[field]
    assert params["variables"] == ["client_name"]


@pytest.mark.parametrize("evidence", [{}, {"source": "formulaire", "confirmed": True}])
def test_consent_encodes_json_evidence(monkeypatch, evidence):
    connection = connection_for(monkeypatch)
    data = Consent(contact="+243000000000", consent_status="OPTED_IN",
                   evidence=evidence).model_dump()

    repo.consent("agency", data)

    params = insert_parameters(connection, "broadcast_consents")
    assert isinstance(params["evidence"], str)
    assert json.loads(params["evidence"]) == evidence
