"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { useOrganization } from "@clerk/nextjs";

export function OrganizationContext() {
  useDashboardMessages();
  const { organization } = useOrganization();

  return (
    <div className="text-xs text-gray-500">
      {organization?.name || dashboardText("Organisation demo")}
    </div>
  );
}

