import { StepRedirectCard } from "@/components/onboarding/StepRedirectCard";

export default function NotificationsOnboardingStep() {
  return (
    <StepRedirectCard
      eyebrow="Notifications"
      title="Préparez les notifications client."
      description="Les notifications contrôlent les messages d’arrivée colis, paiement, livraison et relance."
      primaryHref="/settings"
      primaryLabel="Configurer notifications"
      completeStepKey="NOTIFICATIONS"
      nextHref="/onboarding/team"
    />
  );
}
