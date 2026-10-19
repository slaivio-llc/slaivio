"use client";

import { useState, type ReactNode } from "react";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { BroadcastsPage } from "@/components/broadcasts/broadcasts-page";
import { FollowupsPage } from "@/components/followups/followups-page";

type Section = "announcements" | "reminders";

export function CommunicationAnnouncementsReminders() {
  const [section, setSection] = useState<Section>("announcements");
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);

  return (
    <div className="min-h-full bg-white">
      <OperationPageHeader title="Annonces & Relances" description="Communications ciblées via WhatsApp" actions={headerAction}/>
      <nav
        aria-label="Annonces et relances"
        className="flex gap-1 overflow-x-auto border-b border-[#e6e8e9] px-6"
      >
        {([
          ["announcements", "Annonces"],
          ["reminders", "Relances"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={section === key ? "page" : undefined}
            onClick={() => setSection(key)}
            className={`shrink-0 border-b-2 px-3 py-3 text-[13px] ${
              section === key
                ? "border-[#16855f] font-semibold text-[#126f50]"
                : "border-transparent text-[#68717d] hover:text-[#17212b]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      {section === "announcements" ? <BroadcastsPage embedded onHeaderAction={setHeaderAction}/> : <FollowupsPage embedded onHeaderAction={setHeaderAction}/>}
    </div>
  );
}
