"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

import { EntitlementProvider } from "@/components/entitlements/entitlement-provider";
import { FeatureProvider } from "@/components/features/feature-provider";
import { PermissionProvider } from "@/components/permissions/permission-provider";

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
      {content}
    </ClerkProvider>
  );
}

