"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { EntitlementProvider } from "@/components/entitlements/entitlement-provider";
import { FeatureProvider } from "@/components/features/feature-provider";
import { PermissionProvider } from "@/components/permissions/permission-provider";
import { setAccessTokenProvider } from "@/services/api";
import { SlaivioLogoLoader } from "@/components/ui/slaivio-logo-loader";
import { ApiMutationFeedback } from "@/components/ui/api-mutation-feedback";
import { PilotOfflineProvider } from "@/components/offline/pilot-offline-provider";
import { clearPilotOfflineData } from "@/services/pilot-offline";

export function AppProviders({
  children,
}: {
  children: ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const pathname = usePathname();
  // Marketing pages must never wait for a session or call private APIs.
  // Keep authentication mounted only where it is actually used.
  if (pathname === "/" || pathname === "/landing" || /^\/(fr|en)(\/|$)/.test(pathname)) {
    return <>{children}</>;
  }
  const content = (
    <PermissionProvider>
      <FeatureProvider>
        <EntitlementProvider>{children}<ApiMutationFeedback /></EntitlementProvider>
      </FeatureProvider>
    </PermissionProvider>
  );

  if (!publishableKey) {
    return <PilotOfflineProvider scopeKey="local-development">{content}</PilotOfflineProvider>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkApiAuthBridge>{content}</ClerkApiAuthBridge>
    </ClerkProvider>
  );
}

function ClerkApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId, orgId } = useAuth();
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (ready) { setTimedOut(false); return; }
    const timer = window.setTimeout(() => setTimedOut(true), 15000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!isLoaded) {
      setReady(false);
      return;
    }
    if (!isSignedIn) {
      setAccessTokenProvider(null);
      void clearPilotOfflineData();
      setReady(true);
      return;
    }
    setAccessTokenProvider((options) => getToken(options));
    setReady(true);
    return () => {
      setReady(false);
      setAccessTokenProvider(null);
    };
  }, [getToken, isLoaded, isSignedIn]);

  if (!ready) {
    if (timedOut) {
      return <main role="alert" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 text-sm">
        <h1 className="text-xl font-semibold">Connexion temporairement indisponible</h1>
        <p>Le service d’authentification ne répond pas. Réessayez dans quelques instants.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-[#16855f] px-4 py-2 text-white">Réessayer</button>
        <a href="/fr" className="text-center text-[#16855f]">Retour à l’accueil</a>
      </main>;
    }
    return <SlaivioLogoLoader label="Préparation de votre espace SLAIVIO" />;
  }
  return <PilotOfflineProvider scopeKey={`${userId || "account"}:${orgId || "personal"}`}>{children}</PilotOfflineProvider>;
}
