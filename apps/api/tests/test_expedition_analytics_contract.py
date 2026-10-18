from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_expedition_eta_rate_has_an_explicit_eligible_denominator():
    repository = (ROOT / "apps/api/app/expeditions/repository.py").read_text(encoding="utf-8")
    analytics = repository.split("def expedition_analytics(", 1)[1].split("def get_expedition(", 1)[0]

    assert "delivered_with_eta" in analytics
    assert "delivered_at is not null and eta_at is not null and delivered_at<=eta_at" in analytics
    assert "arrived_with_eta" in analytics
    assert "arrived_at is not null and eta_at is not null and arrived_at<=eta_at" in analytics


def test_transit_duration_uses_only_recorded_departure_times():
    repository = (ROOT / "apps/api/app/expeditions/repository.py").read_text(encoding="utf-8")
    analytics = repository.split("def expedition_analytics(", 1)[1].split("def get_expedition(", 1)[0]

    assert "arrived_at-departed_at" in analytics
    assert "arrived_at is not null and departed_at is not null" in analytics
    assert "delivered_at-departed_at" not in analytics
    assert "coalesce(departed_at,planned_departure_at)" not in analytics
