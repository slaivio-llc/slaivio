"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import { getOrganizationProductProfile, PRODUCT_PROFILES } from "@/config/product-profile";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getTenantContext } from "@/services/tenant";
import { useEffect, useState, type ReactNode } from "react";

export function OperationPageHeader({
  title,
  description,
  actions,
  tabs,
  divider = false,
  wide = false,
  backHref,
  backLabel = "Retour",
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  divider?: boolean;
  wide?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  useDashboardMessages();
  const pathname=usePathname();
  const [parcel,setParcel]=useState(false);
  useEffect(()=>{let active=true;getTenantContext().then(context=>{if(active)setParcel(getOrganizationProductProfile(context.active_tenant?.organization_type)===PRODUCT_PROFILES.PARCEL_FREIGHT);}).catch(()=>undefined);return()=>{active=false;};},[]);
  const parentHref = parcel && ["/app/packages","/app/departures","/app/shipments","/app/warehouses"].includes(pathname) ? "/app/operations" : parcel && ["/app/inbox","/app/followups","/app/knowledge"].includes(pathname) ? "/app/communication" : undefined;
  const resolvedBackHref=backHref || parentHref;
  return (
    <header data-ui="operation-page-header" className="operation-page-header bg-white">
      <div className={`mx-auto w-full px-6 pt-6 sm:px-8 sm:pt-8 ${wide ? "max-w-none" : "max-w-[1200px]"}`}>
        <div className={`flex flex-col gap-3 pb-6 lg:flex-row lg:items-center lg:justify-between ${divider ? "border-b border-[#dfe1e3]" : ""}`}>
          <div className="flex min-w-0 items-start gap-3">
            {resolvedBackHref && (
              <Link
                href={resolvedBackHref}
                aria-label={backLabel}
                title={backLabel}
                className="mt-0.5 inline-grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[#d8dadd] bg-white text-[#3f4851] shadow-[0_1px_1px_rgba(15,23,42,.03)] transition hover:bg-[#f7f7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ed8bc]"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-[#25292e]">{dashboardText(title)}</h1>
              <p className="mt-1.5 max-w-4xl text-[13px] leading-5 text-[#69717a]">
                {dashboardText(description)}
              </p>
            </div>
          </div>
          {actions && (
            <div className="operation-actions flex shrink-0 flex-wrap items-center gap-2 [&>details]:order-first">
              {actions}
            </div>
          )}
        </div>
      </div>
      {tabs && <OperationTabs>{tabs}</OperationTabs>}
    </header>
  );
}

export function OperationTabs({ children, className = "" }: { children: ReactNode; className?: string }) {
  useDashboardMessages();
  return (
    <nav
      data-ui="operation-tabs"
      aria-label={dashboardText("Vues du module")}
      className={`operation-tabs mx-auto flex w-full max-w-[1200px] items-center gap-2 overflow-x-auto bg-white px-6 py-2 sm:px-8 ${className}`}
    >
      {children}
    </nav>
  );
}
