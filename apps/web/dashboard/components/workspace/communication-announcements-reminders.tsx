"use client";

import { useState, type ReactNode } from "react";
import { BroadcastsPage } from "@/components/broadcasts/broadcasts-page";
import { FollowupsPage } from "@/components/followups/followups-page";

type Section = "announcements" | "reminders";

export function CommunicationAnnouncementsReminders() {
  const [section, setSection] = useState<Section>("announcements");
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);

  return (
    <div className="min-h-full bg-white">
      <section className="w-full bg-white">
        <header className="flex min-h-[70px] items-center justify-between gap-4 px-6 py-3 sm:px-8">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#20252b]">Annonces &amp; Relances</h2>
            <p className="mt-1 text-[12px] text-[#737d86]">Communications ciblées via WhatsApp</p>
          </div>
          <div className="shrink-0">{headerAction}</div>
        </header>
        <nav aria-label="Annonces et relances" className="mx-6 grid max-w-[420px] grid-cols-2 rounded-full bg-[#f1f2f2] p-1 sm:mx-8">
          {([
            ["announcements", "Annonces"],
            ["reminders", "Relances"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={section === key ? "page" : undefined}
              onClick={() => setSection(key)}
              className={`min-h-8 rounded-full px-3 text-[12px] transition-colors ${section === key ? "bg-white font-semibold text-[#25292e] shadow-sm" : "font-medium text-[#777f86] hover:text-[#25292e]"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {section === "announcements" ? <BroadcastsPage embedded onHeaderAction={setHeaderAction}/> : <FollowupsPage embedded onHeaderAction={setHeaderAction}/>}
      </section>
    </div>
  );
}
