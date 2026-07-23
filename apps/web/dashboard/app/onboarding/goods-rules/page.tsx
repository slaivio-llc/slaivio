import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function GoodsRulesOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Goods Rules"
      title="Définissez les règles marchandises."
      description="Batteries, liquides, parfums, documents requis, restrictions et validations manuelles."
      primaryHref="/app"
      primaryLabel="Configurer règles"
      completeStepKey="GOODS_RULES"
      nextHref="/onboarding/notifications"
    />
  );
}
