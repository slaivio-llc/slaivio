import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function WarehousesOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Warehouses"
      title="Ajoutez au moins un warehouse réel."
      description="Un warehouse est nécessaire pour recevoir, stocker, tracer et préparer les colis."
      primaryHref="/settings"
      primaryLabel="Configurer warehouses"
      completeStepKey="WAREHOUSES"
      nextHref="/onboarding/routes"
    />
  );
}
