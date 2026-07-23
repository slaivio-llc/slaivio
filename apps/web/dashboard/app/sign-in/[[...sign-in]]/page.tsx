import { ClerkAuthPanel } from "@/components/auth/clerk-auth-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      title="Connexion"
      description="Accédez à votre espace agence et reprenez le contrôle de vos opérations cargo."
    >
      <ClerkAuthPanel mode="sign-in" />
    </AuthShell>
  );
}
