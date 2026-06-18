import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function WhatsappOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="WhatsApp"
      title="Connectez WhatsApp Business officiel."
      description="Cette étape active les conversations client, webhooks, routage multi-numéro et opérations WhatsApp."
      primaryHref="/whatsapp-settings"
      primaryLabel="Connecter WhatsApp"
      completeStepKey="WHATSAPP"
      nextHref="/onboarding/review"
    />
  );
}
