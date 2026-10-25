import { ClerkAuthPanel } from "@/components/auth/clerk-auth-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      title="Connectez-vous à Slaivio"
      description="Retrouvez vos colis, vos expéditions et votre équipe dans un espace dédié au fret."
    >
      <ClerkAuthPanel mode="sign-in" />
    </AuthShell>
  );
}
