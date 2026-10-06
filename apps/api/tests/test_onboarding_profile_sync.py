from sqlalchemy import text

from app.onboarding.repositories import onboarding_repository as repository


def test_profile_is_saved_with_workspace_identity_and_preferences(monkeypatch):
    captured = {}

    def fetch(query, params):
        assert set(text(query).compile().params) <= params.keys()
        captured.update(query=query, params=params)
        return dict(params)

    monkeypatch.setattr(repository, 'fetch_one', fetch)
    result = repository.upsert_agency_profile('office-rdc', {
        'brand_name': 'LUZA RDC', 'business_type': 'PARCEL_FREIGHT',
        'country': 'RDC', 'city': 'Kinshasa', 'default_language': 'fr',
        'default_currency': 'CDF',
    })
    assert result['org_id'] == 'office-rdc'
    assert result['default_currency'] == 'CDF'
    # One statement keeps the profile and dashboard identity in one transaction.
    query = captured['query']
    assert 'update organizations organization' in query
    assert 'organization.id=profile.org_id' in query
    assert 'insert into organization_settings' in query
    assert 'organization_type=profile.business_type' in query
