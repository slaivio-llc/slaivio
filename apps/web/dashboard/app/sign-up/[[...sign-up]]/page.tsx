import { ClerkAuthPanel } from "@/components/auth/clerk-auth-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      title="Créer un compte"
      description="Créez l’accès de votre agence et préparez votre environnement cargo international."
    >
      <ClerkAuthPanel mode="sign-up" />
    </AuthShell>
  );
}
