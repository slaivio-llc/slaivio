"use client";

import { SignIn, SignUp, useUser } from "@clerk/nextjs";

import { AuthSessionState } from "@/components/auth/auth-session-state";
import { clerkAppearance } from "@/components/auth/clerk-appearance";

export function ClerkAuthPanel({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
        Chargement de l'authentification...
      </div>
    );
  }

  if (isSignedIn) {
    return mode === "sign-up" ? (
      <AuthSessionState
        title="Vous avez déjà un compte actif"
        description="Votre session SLAIVIO est déjà ouverte. Déconnectez-vous si vous voulez créer un autre compte."
      />
    ) : (
      <AuthSessionState />
    );
  }

  if (mode === "sign-up") {
    return (
      <SignUp
        appearance={clerkAppearance}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app"
        forceRedirectUrl="/app"
      />
    );
  }

  return (
    <SignIn
      appearance={clerkAppearance}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/app"
      forceRedirectUrl="/app"
    />
  );
}
