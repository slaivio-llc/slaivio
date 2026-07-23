import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function ShippingServicesOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Shipping Services"
      title="Créez vos services d’expédition."
      description="Exemple: Air Express Chine vers Kinshasa, Maritime Chine vers Matadi, local delivery."
      primaryHref="/app"
      primaryLabel="Configurer services"
      completeStepKey="SHIPPING_SERVICES"
      nextHref="/onboarding/pricing"
    />
  );
}
