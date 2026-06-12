"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import type { ComponentType } from "react";
import {
  Home,
  KeyRound,
  LogOut,
  MessageCircle,
} from "lucide-react";

type SidebarItem = {
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{
    size?: number;
  }>;
};

type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

const groups: SidebarGroup[] = [
  {
    label: "Launch Build",
    items: [
      {
        label: "Home",
        description: "Current build sequence",
        href: "/app",
        icon: Home,
      },
      {
        label: "Auth & Access",
        description: "Clerk, users, tenant, roles",
        href: "/settings",
        icon: KeyRound,
      },
    ],
  },
  {
    label: "Next Block",
    items: [
      {
        label: "Onboarding",
        description: "Agency setup and WhatsApp",
        href: "/whatsapp/connect",
        icon: MessageCircle,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  function logout() {
    signOut({
      redirectUrl: "/sign-in",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between px-4 pb-5">
      <nav className="min-h-0 flex-1 space-y-6 overflow-auto pr-1">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
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
                    className={`group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
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
                      <span>
                        <span className="block">{item.label}</span>
                        <span
                          className={`mt-0.5 block text-[11px] font-medium ${
                            isActive
                              ? "text-slate-500"
                              : "text-slate-500 group-hover:text-slate-400"
                          }`}
                        >
                          {item.description}
                        </span>
                      </span>
                    </span>
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </Link>
                );

                return link;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-3">
        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/10 p-3 text-xs text-emerald-100">
          <div className="font-bold">Build Discipline</div>
          <div className="mt-1 leading-5 text-slate-400">
            Auth first. Then onboarding. Then one module at a time.
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-red-500/10"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
