"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { EntitlementGuard } from "@/components/entitlements/entitlement-guard";
import { FeatureGuard } from "@/components/features/feature-guard";
import { PermissionGuard } from "@/components/permissions/permission-guard";

const groups = [
  {
    label: "Command Center",
    items: [
      {
        label: "Inbox",
        href: "/inbox",
        icon: MessageSquare,
      },
      {
        label: "Dossiers",
        href: "/dossiers",
        icon: Package,
      },
      {
        label: "Shipments",
        href: "/shipments",
        icon: Truck,
      },
    ],
  },
  {
    label: "Cargo Operations",
    items: [
      {
        label: "Batches",
        href: "/shipment-batches",
        icon: Boxes,
      },
      {
        label: "Receipts",
        href: "/warehouse/receipts",
        icon: ClipboardList,
      },
      {
        label: "Manifests",
        href: "/manifests",
        icon: FileText,
      },
      {
        label: "Customs",
        href: "/customs/cases",
        icon: ShieldCheck,
      },
      {
        label: "Delivery",
        href: "/delivery/jobs",
        icon: Truck,
      },
    ],
  },
  {
    label: "Growth & Intelligence",
    items: [
      {
        label: "Broadcasts",
        href: "/broadcasts",
        icon: Megaphone,
      },
      {
        label: "Escalations",
        href: "/escalations",
        icon: AlertTriangle,
      },
      {
        label: "Knowledge",
        href: "/knowledge",
        icon: BookOpen,
      },
      {
        label: "Finance",
        href: "/financial",
        icon: BarChart3,
        guarded: true,
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between px-3 pb-5 group-hover/sidebar:px-4">
      <nav className="min-h-0 flex-1 space-y-6 overflow-auto pr-1">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 hidden px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 group-hover/sidebar:block">
              {group.label}
            </div>

            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`group flex items-center justify-center rounded-2xl px-2 py-2.5 text-sm font-semibold transition group-hover/sidebar:justify-between group-hover/sidebar:px-3 ${
                      isActive
                        ? "border border-white/10 bg-white text-slate-950 shadow-lg shadow-black/20"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-white/[0.04] text-slate-400 group-hover:bg-white/10 group-hover:text-white"
                        }`}
                      >
                        <item.icon size={18} />
                      </span>
                      <span className="hidden group-hover/sidebar:inline">
                        {item.label}
                      </span>
                    </span>
                    {isActive && (
                      <span className="hidden h-2 w-2 rounded-full bg-emerald-500 group-hover/sidebar:block" />
                    )}
                  </Link>
                );

                if (item.guarded) {
                  return (
                    <FeatureGuard key={item.href} feature="finance_dashboard">
                      <EntitlementGuard entitlement="finance_dashboard">
                        <PermissionGuard permission="finance.read">
                          {link}
                        </PermissionGuard>
                      </EntitlementGuard>
                    </FeatureGuard>
                  );
                }

                return link;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-5 hidden rounded-3xl border border-white/10 bg-emerald-400/10 p-3 text-xs text-emerald-100 group-hover/sidebar:block">
        <div className="font-bold">Enterprise Cargo Layer</div>
        <div className="mt-1 leading-5 text-slate-400">
          Multi-agency, WhatsApp, finance, warehouse and delivery workflows.
        </div>
      </div>
    </div>
  );
}
