from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPEDITIONS = ROOT / "app" / "expeditions" / "repository.py"
SHIPMENTS_API = ROOT / "app" / "api" / "shipments.py"
DEPARTURES = ROOT / "app" / "departures" / "repository.py"
WEB_ROOT = ROOT.parent / "web" / "dashboard"


def test_assigning_a_package_queues_one_customer_tracking_message():
    repository = EXPEDITIONS.read_text(encoding="utf-8")

    assert "_queue_expedition_assignment_notification" in repository
    assert "EXPEDITION_ASSIGNED:" in repository
    assert "Numéro de suivi" in repository
    assert "public_web_base_url" in repository
    assert "not exists (" in repository.lower()


def test_shipment_endpoint_dispatches_the_queued_whatsapp_message():
    api = SHIPMENTS_API.read_text(encoding="utf-8")

    assert "BackgroundTasks" in api
    assert 'expedition.pop("_queued_notification_ids", [])' in api
    assert "background_tasks.add_task(send_notification" in api


def test_departure_milestones_include_the_public_tracking_link():
    repository = DEPARTURES.read_text(encoding="utf-8")

    assert "tracking_url" in repository
    assert "public_web_base_url" in repository
    assert "Numéro de suivi" in repository


def test_internal_packages_page_does_not_expose_customer_tracking_action():
    page = (WEB_ROOT / "components" / "packages" / "packages-page.tsx").read_text(
        encoding="utf-8"
    )

    assert "Suivi client" not in page
    assert 'window.open("/track"' not in page
    assert (WEB_ROOT / "app" / "track" / "page.tsx").exists()
