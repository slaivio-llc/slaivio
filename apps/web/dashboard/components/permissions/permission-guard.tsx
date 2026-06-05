"use client";

import { usePermission } from "@/hooks/usePermission";

export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { allowed, loading } = usePermission(permission);

  if (loading) {
    return null;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

