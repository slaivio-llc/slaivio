import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function TeamOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Team"
      title="Préparez votre équipe."
      description="Invitez les responsables qui vont gérer inbox, warehouse, finance, douane et livraison."
      primaryHref="/settings"
      primaryLabel="Gérer l’équipe"
      completeStepKey="TEAM"
      nextHref="/onboarding/whatsapp"
    />
  );
}
