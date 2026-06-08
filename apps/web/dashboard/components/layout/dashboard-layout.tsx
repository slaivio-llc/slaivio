"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronRight,
  Globe2,
  Menu,
  Monitor,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

import { Sidebar } from "@/components/sidebar/sidebar";
import { OrganizationSwitcher } from "@/components/tenant/organization-switcher";
import { getCurrentManager } from "@/services/auth";
import type { Manager } from "@/types/auth";

export function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    getCurrentManager()
      .then((managerData) => {
        setManager(managerData);
      })
      .catch(() => {
        router.push("/sign-in");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="slaivo-shell-bg flex h-screen items-center justify-center">
        <div className="slaivo-card rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Sparkles size={22} />
          </div>
          <div className="mt-5 text-lg font-bold">Chargement SLAIVIO</div>
          <div className="mt-2 text-sm text-slate-500">
            Préparation de votre centre opérationnel cargo...
          </div>
        </div>
      </div>
    );
  }

  const managerName =
    manager?.full_name ||
    manager?.name ||
    manager?.email ||
    "Manager SLAIVIO";
  const orgLabel = manager?.org_id || manager?.tenant_org_id || "Organisation";
  const accountEmail = manager?.email || "account@slaivio.com";
  const quickRoutes = [
    { label: "Inbox", href: "/inbox", keywords: "message conversation client whatsapp" },
    { label: "Dossiers", href: "/dossiers", keywords: "dossier client demande" },
    { label: "Shipments", href: "/shipments", keywords: "tracking colis shipment" },
    { label: "Batches", href: "/shipment-batches", keywords: "batch consolidation" },
    { label: "Warehouse Receipts", href: "/warehouse/receipts", keywords: "warehouse receipt reception scan" },
    { label: "Manifests", href: "/manifests", keywords: "manifest document" },
    { label: "Customs", href: "/customs/cases", keywords: "douane customs compliance" },
    { label: "Delivery", href: "/delivery/jobs", keywords: "livraison delivery pickup" },
    { label: "Broadcasts", href: "/broadcasts", keywords: "campagne broadcast marketing" },
    { label: "Settings", href: "/settings", keywords: "parametre settings whatsapp billing profile" },
  ];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const route =
      quickRoutes.find((item) =>
        `${item.label} ${item.keywords}`.toLowerCase().includes(query)
      ) || quickRoutes.find((item) => query.includes(item.label.toLowerCase()));

    if (route) {
      router.push(route.href);
      setSearchQuery("");
    }
  }

  return (
    <div className="slaivo-shell-bg min-h-screen">
      <aside className="group/sidebar fixed inset-y-0 left-0 z-40 hidden w-20 overflow-hidden border-r border-white/10 bg-[#0b1120] text-white shadow-2xl transition-all duration-300 hover:w-80 xl:block">
        <div className="flex h-full flex-col">
          <SidebarHeader managerName={managerName} orgLabel={orgLabel} />
          <div className="hidden px-5 pb-4 group-hover/sidebar:block">
            <OrganizationSwitcher variant="dark" />
          </div>
          <Sidebar />
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative h-full w-[86vw] max-w-sm bg-[#0b1120] text-white shadow-2xl">
            <div className="absolute right-4 top-4">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl border border-white/10 p-2 text-slate-300"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarHeader managerName={managerName} orgLabel={orgLabel} />
            <div className="px-5 pb-4">
              <OrganizationSwitcher variant="dark" />
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="min-h-screen xl:pl-20">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm xl:hidden"
            >
              <Menu size={19} />
            </button>

            <form
              onSubmit={submitSearch}
              className="hidden min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100 md:flex"
            >
              <Search size={18} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher dossier, tracking, client, batch..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </form>

            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setFeedbackOpen((value) => !value)}
                  className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 lg:block"
                >
                  Feedback
                </button>
                {feedbackOpen && (
                  <div className="absolute right-0 top-14 w-96 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
                    <div className="grid grid-cols-2 gap-3">
                      <button className="rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50">
                        <div className="text-sm font-black text-slate-950">Issue</div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Signaler un problème bloquant.
                        </p>
                      </button>
                      <button className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                        <div className="text-sm font-black text-emerald-950">Idea</div>
                        <p className="mt-1 text-xs leading-5 text-emerald-700">
                          Proposer une amélioration.
                        </p>
                      </button>
                    </div>
                    <textarea
                      value={feedbackText}
                      onChange={(event) => setFeedbackText(event.target.value)}
                      placeholder="My idea for improving SLAIVIO is..."
                      className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button className="text-sm font-bold text-slate-500">
                        Get help instead
                      </button>
                      <button
                        onClick={() => {
                          setFeedbackText("");
                          setFeedbackOpen(false);
                        }}
                        className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((value) => !value)}
                  className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  <Bell size={18} />
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                    3
                  </span>
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-14 w-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-slate-950">Notifications</div>
                      <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-600">
                        3 open
                      </span>
                    </div>
                    {[
                      "Cas douane à valider",
                      "Message client sans réponse",
                      "Delivery job en attente de preuve",
                    ].map((item) => (
                      <button
                        key={item}
                        className="mt-3 w-full rounded-2xl border border-slate-200 p-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setAccountOpen((value) => !value)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black text-white shadow-lg shadow-emerald-500/20">
                  {managerName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden text-sm md:block">
                  <div className="font-semibold text-slate-900">
                    {managerName}
                  </div>
                  <div className="text-xs text-slate-500">{orgLabel}</div>
                </div>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-14 w-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
                    <div className="border-b border-slate-100 pb-4">
                      <div className="font-black text-slate-950">{orgLabel}</div>
                      <div className="mt-1 text-sm text-slate-500">{accountEmail}</div>
                    </div>
                    <AccountMenuItem label="Light theme" icon={<Sun size={16} />} />
                    <AccountMenuItem label="Classic dark" icon={<Monitor size={16} />} />
                    <AccountMenuItem label="System theme" icon={<Monitor size={16} />} />
                    <AccountMenuItem label="Feature preview" icon={<Sparkles size={16} />} />
                    <AccountMenuItem label="Timezone" icon={<ChevronRight size={16} />} value="Africa/Kinshasa" />
                    <SignOutButton redirectUrl="/sign-in">
                      <button className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-left text-sm font-black text-white">
                        Log out
                      </button>
                    </SignOutButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="slaivo-grid-bg min-h-[calc(100vh-73px)] overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarHeader({
  managerName,
  orgLabel,
}: {
  managerName: string;
  orgLabel: string;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/5 shadow-lg ring-1 ring-white/10">
          <img
            src="/slaivio-icon.png"
            alt="SLAIVIO"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="hidden group-hover/sidebar:block">
          <div className="text-2xl font-black tracking-tight">SLAIVIO</div>
          <div className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">
            Cargo OS
          </div>
        </div>
      </div>

      <div className="mt-6 hidden rounded-3xl border border-white/10 bg-white/[0.045] p-4 group-hover/sidebar:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {managerName}
            </div>
            <div className="truncate text-xs text-slate-400">
              {orgLabel}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-2 text-xs text-slate-300">
          <Globe2 size={14} className="text-emerald-300" />
          Multi-country operations
        </div>
      </div>
    </div>
  );
}

function AccountMenuItem({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value?: string;
}) {
  return (
    <button className="mt-2 flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
      <span className="flex items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>
      {value && <span className="text-xs text-slate-400">{value}</span>}
    </button>
  );
}
