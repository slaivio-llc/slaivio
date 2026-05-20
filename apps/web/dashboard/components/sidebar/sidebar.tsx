"use client";

import {
  MessageSquare,
  Package,
  Bell,
  AlertTriangle,
  Truck,
} from "lucide-react";

const items = [
  {
    label: "Inbox",
    icon: MessageSquare,
  },
  {
    label: "Dossiers",
    icon: Package,
  },
  {
    label: "Shipments",
    icon: Truck,
  },
  {
    label: "Notifications",
    icon: Bell,
  },
  {
    label: "Escalations",
    icon: AlertTriangle,
  },
];

export function Sidebar() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            className="
              flex items-center gap-3 rounded-xl
              px-4 py-3 text-sm font-medium
              hover:bg-muted transition
            "
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
