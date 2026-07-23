import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function PricingOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Pricing"
      title="Configurez vos prix avant les devis."
      description="Sans pricing réel, SLAIVIO ne doit pas générer de devis automatiques pour vos clients."
      primaryHref="/app"
      primaryLabel="Configurer pricing"
      completeStepKey="PRICING"
      nextHref="/onboarding/goods-rules"
    />
  );
}
