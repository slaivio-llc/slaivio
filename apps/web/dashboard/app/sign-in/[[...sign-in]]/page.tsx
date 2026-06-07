import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/components/auth/clerk-appearance";

export default function Page() {
  return (
    <AuthShell
      title="Connexion"
      description="Accédez à votre espace agence et reprenez le contrôle de vos opérations cargo."
    >
      <SignIn
        appearance={clerkAppearance}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </AuthShell>
  );
}
