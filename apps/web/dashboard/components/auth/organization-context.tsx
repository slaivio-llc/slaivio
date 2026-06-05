"use client";

import { useOrganization } from "@clerk/nextjs";

export function OrganizationContext() {
  const { organization } = useOrganization();

  return (
    <div className="text-xs text-gray-500">
      {organization?.name || "Organisation demo"}
    </div>
  );
}

