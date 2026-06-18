import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function WorkspacesOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Offices / Workspaces"
      title="Configurez vos bureaux et points opérationnels."
      description="Les workspaces représentent les agences, branches ou points de pickup qui structurent vos opérations."
      primaryHref="/settings"
      primaryLabel="Ouvrir les settings"
      completeStepKey="WORKSPACES"
      nextHref="/onboarding/warehouses"
    />
  );
}
