"use client";

import { useFeatures } from "@/components/features/feature-provider";

export function FeatureGuard({
  feature,
  children,
  fallback = null,
}: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { features, loading } = useFeatures();

  if (loading) {
    return null;
  }

  if (!features[feature]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

