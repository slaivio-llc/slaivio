"use client";

import { useState, type ReactNode } from "react";
import { BroadcastsPage } from "@/components/broadcasts/broadcasts-page";
import { FollowupsPage } from "@/components/followups/followups-page";

type Section = "announcements" | "reminders";

export function CommunicationAnnouncementsReminders() {
  const [section, setSection] = useState<Section>("announcements");
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);

  return (
    <div className="communication-announcements-shell min-h-full bg-white">
      <section className="w-full bg-white">
        <header className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 py-3">
        <nav aria-label="Annonces et relances" className="grid h-10 w-full max-w-[420px] shrink-0 grid-cols-2 bg-[#f1f2f2] p-1">
          {([
            ["announcements", "Annonces"],
            ["reminders", "Relances"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={section === key ? "page" : undefined}
              onClick={() => setSection(key)}
              className={`h-full rounded-none px-3 text-[12px] transition-colors ${section === key ? "bg-[#111111] font-semibold text-white" : "font-medium text-[#777f86] hover:text-[#25292e]"}`}
            >
              {label}
            </button>
          ))}
        </nav>
          <div className="shrink-0">{headerAction}</div>
        </header>
        {section === "announcements" ? <BroadcastsPage embedded onHeaderAction={setHeaderAction}/> : <FollowupsPage embedded onHeaderAction={setHeaderAction}/>}
      </section>
    </div>
  );
}
