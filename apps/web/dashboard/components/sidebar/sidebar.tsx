"use client";

import Link from "next/link";
import {
  MessageSquare,
  Package,
  AlertTriangle,
  Truck,
  Megaphone,
  Settings,
  MessageCircle,
  LogOut,
  BookOpen,
} from "lucide-react";

const items = [
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
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "WhatsApp Settings",
    href: "/whatsapp-settings",
    icon: MessageCircle,
  },
];

export function Sidebar() {
  function logout() {
    localStorage.removeItem("slaivo_token");
    localStorage.removeItem("slaivo_manager");
    window.location.href = "/login";
  }

  return (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-black/5"
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <button
        onClick={logout}
        className="mt-8 flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50"
      >
        <LogOut size={18} />
        Déconnexion
      </button>
    </div>
  );
}
