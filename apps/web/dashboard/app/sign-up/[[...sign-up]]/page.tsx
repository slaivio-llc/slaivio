import { ClerkAuthPanel } from "@/components/auth/clerk-auth-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      title="Créez votre espace Slaivio"
      description="Configurez votre agence de colis et fret, puis centralisez vos opérations. Vous pourrez inviter votre équipe depuis les paramètres."
    >
      <ClerkAuthPanel mode="sign-up" />
    </AuthShell>
  );
}
