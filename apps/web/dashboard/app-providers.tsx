"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ReactNode, useEffect } from "react";

import { EntitlementProvider } from "@/components/entitlements/entitlement-provider";
import { FeatureProvider } from "@/components/features/feature-provider";
import { PermissionProvider } from "@/components/permissions/permission-provider";
import { setAccessTokenProvider } from "@/services/api";

export function AppProviders({
  children,
}: {
  children: ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = (
    <PermissionProvider>
      <FeatureProvider>
        <EntitlementProvider>{children}</EntitlementProvider>
      </FeatureProvider>
    </PermissionProvider>
  );

  if (!publishableKey) {
    return content;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkApiAuthBridge>{content}</ClerkApiAuthBridge>
    </ClerkProvider>
  );
}

function ClerkApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setAccessTokenProvider(() => getToken());
    return () => setAccessTokenProvider(null);
  }, [getToken, isLoaded]);

  return children;
}

