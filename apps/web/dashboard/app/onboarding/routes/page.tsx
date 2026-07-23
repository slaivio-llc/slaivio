import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function RoutesOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Routes"
      title="Définissez vos routes cargo principales."
      description="Les routes clarifient les pays d’origine, destinations, modes de transport et délais."
      primaryHref="/app"
      primaryLabel="Configurer routes"
      completeStepKey="ROUTES"
      nextHref="/onboarding/shipping-services"
    />
  );
}
