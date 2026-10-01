from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_onboarding_v2_is_short_localized_and_product_aware():
    repository = read("apps/api/app/onboarding_experience/repositories/onboarding_experience_repository.py")
    service = read("apps/api/app/onboarding_experience/services/onboarding_experience_service.py")
    assert 'journey_version: str = "v2"' in repository
    for step in ("AGENCY_PROFILE", "OPERATIONS", "WHATSAPP", "AI_KNOWLEDGE", "REVIEW"):
        assert step in repository
    for removed in ('("WAREHOUSES",', '("ROUTES",', '("PRICING",'):
        assert removed not in repository
    assert '"key": "OPERATIONS_INCOMPLETE"' in service
    assert "onboarding_step_not_found" in service
    assert 'item["status"] == "IN_PROGRESS"' in service


def test_onboarding_pages_collect_real_data_without_manual_completion_cards():
    root = ROOT / "apps/web/dashboard"
    welcome = (root / "app/onboarding/welcome/page.tsx").read_text(encoding="utf-8")
    profile = (root / "app/onboarding/agency-profile/page.tsx").read_text(encoding="utf-8")
    operations = (root / "app/onboarding/operations/page.tsx").read_text(encoding="utf-8")
    whatsapp = (root / "app/onboarding/whatsapp/page.tsx").read_text(encoding="utf-8")
    ai = (root / "app/onboarding/ai-knowledge/page.tsx").read_text(encoding="utf-8")
    shell = (root / "components/onboarding/OnboardingShell.tsx").read_text(encoding="utf-8")
    assert "saveAgencyProfile" in profile and "PARCEL_FREIGHT" in profile
    assert 'router.push("/onboarding/agency-profile")' in welcome
    assert "completeOnboardingStep" not in welcome
    assert 'completeOnboardingStep("WELCOME")' in profile
    assert "saveLocation" in operations
    assert "startPilotWhatsappQR" in whatsapp and "getPilotWhatsappQRStatus" in whatsapp
    assert "createPilotKnowledge" in ai and "updateInboxAIMode" in ai
    assert "bg-white" in shell and "Progression de la configuration" in shell
    assert not (root / "components/onboarding/StepRedirectCard.tsx").exists()
