"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Bell, BellRing, BookOpen, Clock3, MessageCircle, Megaphone, Settings2, UserRound } from "lucide-react";
import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { PilotInboxPage } from "@/components/inbox/pilot-inbox-page";
import { CommunicationAnnouncementsReminders } from "@/components/workspace/communication-announcements-reminders";
import { KnowledgePage } from "@/components/knowledge/knowledge-page";
import { NotificationCenterPage } from "@/components/notifications/notification-center-page";
import { PilotSettingsPage } from "@/components/settings/pilot-settings-page";
import { listInboxConversations, type InboxConversation } from "@/services/inbox";
import { listNotifications } from "@/services/notification-center";
import { listCampaigns } from "@/services/broadcasts";

const tabs = [
  ["overview", "Vue d’ensemble"],
  ["inbox", "Réception"],
  ["announcements", "Annonces"],
  ["knowledge", "Connaissances"],
  ["notifications", "Notifications"],
  ["settings", "Paramètres"],
] as const;
type Tab = (typeof tabs)[number][0];

type Overview = { open: number | null; waiting: number | null; notifications: number | null; campaigns: number | null; conversations: InboxConversation[] | null };

export function ParcelCommunicationHub() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      listInboxConversations({ view: "all", page: 1 }),
      listInboxConversations({ view: "waiting", page: 1 }),
      listNotifications({ status: "UNREAD", page: 1, page_size: 1 }),
      listCampaigns({ page: 1, page_size: 1 }),
    ]).then(([all, waiting, notifications, campaigns]) => {
      if (!active) return;
      setOverview({
        open: all.status === "fulfilled" ? all.value.pagination.total : null,
        waiting: waiting.status === "fulfilled" ? waiting.value.pagination.total : null,
        notifications: notifications.status === "fulfilled" ? notifications.value.stats.unread : null,
        campaigns: campaigns.status === "fulfilled" ? campaigns.value.stats.active ?? 0 : null,
        conversations: waiting.status === "fulfilled" ? waiting.value.conversations.slice(0, 2) : null,
      });
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return <div className="min-h-full bg-white">
    <OperationPageHeader title="Communication" description="Gérez les échanges avec vos clients." />
    <nav aria-label="Sections Communication" className="mb-4 flex flex-wrap gap-1 px-6 sm:px-8">
      {tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors ${tab === key ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>{label}</button>)}
    </nav>

    {tab === "overview" && <OverviewPanel overview={overview} loading={loading} openTab={setTab} />}
    {tab === "inbox" && <PermissionGuard permission="inbox.read"><PilotInboxPage embedded /></PermissionGuard>}
    {tab === "announcements" && <CommunicationAnnouncementsReminders />}
    {tab === "knowledge" && <PermissionGuard permission="pilot.knowledge.read"><KnowledgePage embedded /></PermissionGuard>}
    {tab === "notifications" && <PermissionGuard permission="notifications.read"><NotificationCenterPage /></PermissionGuard>}
    {tab === "settings" && <PermissionGuard permission="pilot.settings.read"><PilotSettingsPage scope="communication" embedded /></PermissionGuard>}
  </div>;
}

function OverviewPanel({ overview, loading, openTab }: { overview: Overview | null; loading: boolean; openTab: (tab: Tab) => void }) {
  const metrics = [
    { label: "Conversations ouvertes", value: overview?.open, icon: MessageCircle },
    { label: "À traiter", value: overview?.waiting, icon: Clock3 },
    { label: "Notifications en attente", value: overview?.notifications, icon: Bell },
    { label: "Campagnes actives", value: overview?.campaigns, icon: Megaphone },
  ];
  const shortcuts: { tab: Tab; title: string; description: string; icon: typeof MessageCircle }[] = [
    { tab: "inbox", title: "Boîte de réception", description: "Conversations WhatsApp et demandes clients", icon: MessageCircle },
    { tab: "announcements", title: "Annonces & Relances", description: "Campagnes et rappels aux clients", icon: Megaphone },
    { tab: "knowledge", title: "Connaissances", description: "Informations utilisées par l’équipe et l’IA", icon: BookOpen },
    { tab: "notifications", title: "Notifications", description: "Messages envoyés et événements à suivre", icon: BellRing },
    { tab: "settings", title: "Paramètres", description: "Canaux, réponses IA et préférences", icon: Settings2 },
  ];

  return <OperationContent className="grid gap-3 pb-8">
    <div className="grid gap-2 sm:grid-cols-2">
      {metrics.map(({ label, value, icon: Icon }) => <div key={label} className="min-h-[68px] rounded-[8px] border border-[#dfe3e7] p-3"><div className="flex items-center justify-between text-[11px] text-[#747e86]"><span>{label}</span><Icon size={13} /></div><p className="mt-2 text-[18px] font-semibold tabular-nums text-[#25292e]">{loading ? "—" : value == null ? "Indisponible" : value.toLocaleString("fr-FR")}</p></div>)}
    </div>

    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[13px] font-semibold text-[#30373d]">Conversations à traiter</h2><button type="button" onClick={() => openTab("inbox")} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#626d75] hover:text-[#16704b]">Voir tout <ArrowRight size={12} /></button></div>
      <div className="divide-y divide-[#eceeef] rounded-[8px] border border-[#dfe3e7] px-3">
        {loading ? <p className="py-4 text-[12px] text-[#747e86]">Chargement des conversations…</p> : overview?.conversations === null ? <p className="py-4 text-[12px] text-[#747e86]">Conversations indisponibles pour ce compte.</p> : overview?.conversations.length ? overview.conversations.map(item => <button key={item.phone} type="button" onClick={() => openTab("inbox")} className="flex w-full items-center gap-3 py-3 text-left hover:bg-[#fbfcfb]"><UserRound size={14} className="shrink-0 text-[#78838c]" /><span className="min-w-0 flex-1"><strong className="block truncate text-[12px] font-medium text-[#30373d]">{item.client_name || item.conversation_name || item.phone}</strong><span className="mt-0.5 block truncate text-[11px] text-[#747e86]">{item.last_message || "Nouveau message"}</span></span><span className="text-[10px] text-[#8a939b]">{new Date(item.last_message_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></button>) : <p className="py-4 text-[12px] text-[#747e86]">Aucune conversation à traiter.</p>}
      </div>
    </section>

    <section>
      <h2 className="mb-2 text-[13px] font-semibold text-[#30373d]">Accès rapide</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {shortcuts.map(({ tab: target, title, description, icon: Icon }) => <button key={target} type="button" onClick={() => openTab(target)} className="group min-h-[78px] rounded-[8px] border border-[#dfe3e7] p-3 text-left transition-colors hover:border-[#b9c6c0] hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ccdb8]"><div className="flex items-center justify-between"><Icon size={15} className="text-[#68756f]"/><ArrowRight size={12} className="text-[#9aa2a9] group-hover:text-[#16704b]"/></div><h3 className="mt-2 text-[12px] font-semibold text-[#30373d]">{title}</h3><p className="mt-0.5 text-[10px] leading-4 text-[#747e86]">{description}</p></button>)}
      </div>
    </section>
  </OperationContent>;
}
