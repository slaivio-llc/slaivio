"use client";

import { useEntitlements } from "@/components/entitlements/entitlement-provider";

export function EntitlementGuard({
  entitlement,
  children,
  fallback = null,
}: {
  entitlement: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { entitlements, loading } = useEntitlements();

  if (loading) {
    return null;
  }

  if (!entitlements[entitlement]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

