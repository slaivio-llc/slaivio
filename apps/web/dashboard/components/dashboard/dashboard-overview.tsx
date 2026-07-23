"use client";

import { useClerk } from "@clerk/nextjs";
import {
  Bell, BookOpen, Boxes, Building2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, CreditCard, FileText, Folder, Grid2X2, Home, Languages, LayoutList,
  LifeBuoy, LogOut, Map, Menu, MessageCircle, Package, Radio, Receipt, Search,
  Send, Settings, Star, Truck, UserRound, Users, Warehouse, X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type ComponentType, type ReactNode,
} from "react";

import {
  getDashboardHome, markAllHomeNotificationsRead, markHomeNotificationRead,
  searchDashboardHome, updateHomeResource, type DashboardHome,
  type HomeAttentionItem, type HomeNotification, type HomeResource,
  type HomeSearchResult,
} from "@/services/dashboard";

type Panel = "notifications" | "account" | "help" | null;
type HomeFilter = "all" | "recent" | "starred";

const icons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  clients: Users, dossiers: Folder, packages: Package, shipments: Truck, tracking: Search,
  inbox: MessageCircle, broadcasts: Send, followups: Radio, payments: CreditCard,
  invoices: FileText, expenses: Receipt, workspaces: Building2, warehouses: Warehouse,
  routes: Map, team: Users, reports: LayoutList,
};
const tones: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600", green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

export function DashboardOverviewPage() {
  const { signOut } = useClerk();
  const [data, setData] = useState<DashboardHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HomeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getDashboardHome()); setError(""); }
    catch { setError("Impossible de charger les données de votre agence."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchInput.current?.focus();
      }
      if (event.key === "Escape") { setPanel(null); setQuery(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchDashboardHome(query, controller.signal)); }
      catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  const resources = useMemo(() => {
    const all = data?.resources || [];
    if (filter === "starred") return all.filter((item) => item.is_starred);
    if (filter === "recent") return all.filter((item) => item.last_opened_at).sort((a, b) => (b.last_opened_at || "").localeCompare(a.last_opened_at || ""));
    return all;
  }, [data, filter]);

  async function toggleStar(resource: HomeResource) {
    if (!data) return;
    const previous = data;
    const next = !resource.is_starred;
    setData({ ...data, resources: data.resources.map((item) => item.key === resource.key ? { ...item, is_starred: next } : item) });
    try { await updateHomeResource(resource.key, { is_starred: next }); }
    catch { setData(previous); setError("Le favori n’a pas pu être enregistré."); }
  }

  async function openResource(resource: HomeResource) {
    try { await updateHomeResource(resource.key, { opened: true }); }
    finally { window.location.assign(resource.href); }
  }

  async function readNotification(id: string) {
    if (!data) return;
    const target = data.notifications.find((item) => item.id === id);
    if (!target || target.is_read) return;
    setData({ ...data, unread_count: Math.max(0, data.unread_count - 1), notifications: data.notifications.map((item) => item.id === id ? { ...item, is_read: true } : item) });
    try { await markHomeNotificationRead(id); } catch { void load(); }
  }

  async function readAllNotifications() {
    if (!data) return;
    setData({ ...data, unread_count: 0, notifications: data.notifications.map((item) => ({ ...item, is_read: true })) });
    try { await markAllHomeNotificationsRead(); } catch { void load(); }
  }

  if (!loading && data?.status === "no_workspace") return <NoWorkspace />;

  return (
    <div className="h-dvh overflow-hidden bg-[#f7f8fa] text-[#11182d]">
      <GlobalHeader data={data} query={query} setQuery={setQuery} searchInput={searchInput} panel={panel} setPanel={setPanel} openSidebar={() => setSidebarOpen(true)} />
      <div className="flex h-[calc(100dvh-58px)]">
        <Sidebar open={sidebarOpen} compact={sidebarCompact} unread={data?.unread_count || 0} workspace={data?.workspace} close={() => setSidebarOpen(false)} toggleCompact={() => setSidebarCompact((value) => !value)} />
        <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 lg:px-12 lg:py-8">
          <PageHeader data={data} />
          {query.trim().length >= 2 && <SearchResults results={results} searching={searching} />}
          {error && <ErrorBanner message={error} retry={load} />}
          <WelcomeBanner manager={data?.manager.name} whatsappConfigured={data?.whatsapp.configured} />
          <Attention items={data?.attention_items || []} loading={loading} />

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Vos espaces Slaivio</h2>
                <p className="mt-1 text-sm text-slate-500">Les chiffres affichés proviennent de l’agence active.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 bg-white p-1">
                  {(["all", "recent", "starred"] as HomeFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === item ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}>{item === "all" ? "Tous" : item === "recent" ? "Récents" : "Favoris"}</button>)}
                </div>
                <button aria-label="Vue liste" onClick={() => setView("list")} className={`rounded-lg p-2 ${view === "list" ? "bg-slate-200" : "text-slate-400"}`}><LayoutList size={18} /></button>
                <button aria-label="Vue grille" onClick={() => setView("grid")} className={`rounded-lg p-2 ${view === "grid" ? "bg-slate-200" : "text-slate-400"}`}><Grid2X2 size={18} /></button>
              </div>
            </div>
            {loading ? <ResourceSkeleton /> : resources.length ? <ResourceGrid resources={resources} view={view} open={openResource} star={toggleStar} /> : <EmptyResources filter={filter} />}
          </section>
        </main>
        </div>
      </div>
      {panel === "notifications" && <NotificationsPanel data={data} close={() => setPanel(null)} read={readNotification} readAll={readAllNotifications} />}
      {panel === "account" && <AccountPanel data={data} close={() => setPanel(null)} logout={() => signOut({ redirectUrl: "/sign-in" })} />}
      {panel === "help" && <HelpPanel close={() => setPanel(null)} />}
    </div>
  );
}

const navGroups = [
  { label: "OPÉRATIONS", items: [["Accueil", Home, "/app"], ["Clients", Users, "/app/clients"], ["Dossiers", Folder, "/app/dossiers"], ["Colis", Package, "/app/packages"], ["Expéditions", Truck, "/app/shipments"], ["Tracking", Search, "/app/tracking"]] },
  { label: "COMMUNICATION", items: [["WhatsApp Inbox", MessageCircle, "/app/inbox"], ["Broadcasts", Send, "/app/broadcasts"], ["Relances", Radio, "/app/followups"]] },
  { label: "FINANCE", items: [["Paiements", CreditCard, "/app/payments"], ["Factures", FileText, "/app/invoices"], ["Dépenses", Receipt, "/app/expenses"]] },
  { label: "RÉSEAU CARGO", items: [["Workspaces", Building2, "/app/workspaces"], ["Entrepôts", Warehouse, "/app/warehouses"], ["Routes", Map, "/app/routes"]] },
  { label: "GESTION", items: [["Équipe", Users, "/app/team"], ["Rapports", LayoutList, "/app/reports"], ["Paramètres", Settings, "/app/settings"]] },
] as const;

function Sidebar({ open, compact, unread, workspace, close, toggleCompact }: { open: boolean; compact: boolean; unread: number; workspace?: DashboardHome["workspace"]; close: () => void; toggleCompact: () => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "OPÉRATIONS": true });
  return <><button aria-label="Fermer le menu" onClick={close} className={`fixed inset-0 z-40 bg-slate-950/25 lg:hidden ${open ? "block" : "hidden"}`} /><aside className={`fixed bottom-0 left-0 top-[58px] z-50 flex shrink-0 flex-col border-r border-[#d9dce1] bg-white transition-all lg:relative lg:top-0 lg:z-auto ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${compact ? "w-[52px]" : "w-[250px]"}`}>
    <div className="flex items-center gap-2 p-2"><Link href="/app" className={`flex min-h-10 flex-1 items-center gap-3 rounded-md bg-[#eef0f4] px-3 text-sm font-semibold ${compact ? "justify-center px-0" : ""}`}><Home size={19} /><span className={compact ? "hidden" : ""}>Accueil</span></Link><button onClick={toggleCompact} aria-label="Réduire le menu" className="hidden rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:block">{compact ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button><button onClick={close} className="rounded-md p-2 lg:hidden"><X size={18} /></button></div>
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">{navGroups.map((group) => { const expanded = compact || !!openGroups[group.label]; return <div key={group.label} className="mb-1"><button onClick={() => !compact && setOpenGroups((current) => ({ ...current, [group.label]: !expanded }))} className={`flex min-h-9 w-full items-center rounded-md px-3 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 ${compact ? "justify-center px-0" : ""}`}><Boxes size={16} /><span className={`ml-3 ${compact ? "hidden" : ""}`}>{group.label}</span>{!compact && <ChevronDown size={15} className={`ml-auto transition ${expanded ? "rotate-180" : ""}`} />}</button>{expanded && <div className="space-y-0.5 pb-1">{group.items.filter(([, , href]) => href !== "/app").map(([label, Icon, href]) => <a key={href} href={href} title={compact ? label : undefined} className={`flex min-h-9 items-center gap-3 rounded-md px-3 text-sm text-slate-700 hover:bg-[#f3f4f6] ${compact ? "justify-center px-0" : ""}`}><Icon size={17} /><span className={compact ? "hidden" : ""}>{label}</span>{label === "WhatsApp Inbox" && unread > 0 && !compact && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">{unread}</span>}</a>)}</div>}</div>; })}</nav>
    <div className="border-t border-slate-200 p-2"><button className={`flex min-h-12 w-full items-center rounded-md px-3 hover:bg-slate-50 ${compact ? "justify-center px-0" : ""}`}><Building2 className="text-emerald-600" size={19} />{!compact && <><span className="ml-3 min-w-0 flex-1 text-left"><span className="block text-[10px] text-slate-500">Workspace</span><span className="block truncate text-sm font-semibold">{workspace?.name || "Slaivio"}</span></span><ChevronDown size={15} /></>}</button></div>
  </aside></>;
}

function GlobalHeader({ data, query, setQuery, searchInput, panel, setPanel, openSidebar }: { data: DashboardHome | null; query: string; setQuery: (value: string) => void; searchInput: React.RefObject<HTMLInputElement | null>; panel: Panel; setPanel: (value: Panel) => void; openSidebar: () => void }) { return <header className="relative z-40 flex h-[58px] items-center border-b border-[#d9dce1] bg-white px-3 sm:px-5"><button onClick={openSidebar} aria-label="Menu" className="mr-2 rounded-md p-2 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button><div className="flex w-[235px] shrink-0 items-center gap-2"><Image src="/slaivio-icon-official.png" width={30} height={30} alt="Slaivio" className="rounded-md" /><span className="text-xl font-bold tracking-tight">Slaivio</span></div><label className="absolute left-1/2 hidden w-[min(430px,38vw)] -translate-x-1/2 items-center rounded-full border border-[#d9dce1] bg-white px-4 py-2 shadow-sm focus-within:border-slate-400 sm:flex"><Search size={16} className="text-slate-500" /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans Slaivio…" className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none" /><kbd className="text-xs text-slate-400">Ctrl K</kbd></label><div className="ml-auto flex items-center gap-1"><button onClick={() => setPanel(panel === "help" ? null : "help")} className="hidden items-center gap-1 rounded-full px-3 py-2 text-sm hover:bg-slate-100 sm:flex"><CircleHelp size={16} /> Aide</button><button onClick={() => setPanel(panel === "notifications" ? null : "notifications")} aria-label="Notifications" className="relative rounded-full p-2.5 hover:bg-slate-100"><Bell size={18} />{!!data?.unread_count && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}</button><button onClick={() => setPanel(panel === "account" ? null : "account")} aria-label="Compte" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b8f8f] text-xs font-semibold text-white">{data?.manager.initials || "SL"}</button></div></header>; }

function PageHeader({ data }: { data: DashboardHome | null }) { return <header><h1 className="text-[28px] font-semibold tracking-[-0.035em]">Accueil</h1><p className="mt-2 text-sm text-slate-600">Retrouvez vos espaces et reprenez les opérations de {data?.workspace.name || "votre agence"}.</p></header>; }

function WelcomeBanner({ manager, whatsappConfigured }: { manager?: string; whatsappConfigured?: boolean }) { const [visible, setVisible] = useState(true); if (!visible) return null; return <section className="relative mt-7 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-blue-50 px-6 py-6 lg:px-8"><button onClick={() => setVisible(false)} aria-label="Fermer" className="absolute right-4 top-4 rounded-lg p-1 hover:bg-white"><X size={17} /></button><div className="relative z-10 max-w-3xl"><p className="text-lg font-semibold">Bienvenue {manager?.split(" ")[0] || "dans Slaivio"}</p><p className="mt-2 text-sm leading-6 text-slate-600">Clients, dossiers, colis, expéditions, paiements et communications : votre activité cargo réunie dans un espace sécurisé.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/app/dossiers" className="rounded-lg bg-[#10b953] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">Créer un dossier</Link>{!whatsappConfigured && <Link href="/app/whatsapp-settings" className="rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700">Configurer WhatsApp</Link>}</div></div><div className="absolute -bottom-20 right-20 h-48 w-48 rounded-full bg-emerald-200/50 blur-2xl" /></section>; }

function Attention({ items, loading }: { items: HomeAttentionItem[]; loading: boolean }) { return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold">À traiter</h2><p className="mt-1 text-xs text-slate-500">Priorités calculées à partir des données de l’agence.</p></div>{items.length > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{items.length} action{items.length > 1 ? "s" : ""}</span>}</div>{loading ? <div className="mt-4 h-14 animate-pulse rounded-xl bg-slate-100" /> : items.length ? <div className="mt-4 grid gap-2 lg:grid-cols-2">{items.map((item) => <a key={`${item.kind}-${item.id}`} href={item.href} className="flex items-center rounded-xl border border-slate-100 p-3 hover:bg-slate-50"><span className={`h-2.5 w-2.5 rounded-full ${item.priority === "HIGH" ? "bg-red-500" : "bg-amber-400"}`} /><span className="ml-3 min-w-0"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-slate-500">{item.message}</span></span><ChevronRight className="ml-auto text-slate-400" size={17} /></a>)}</div> : <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-800"><span className="font-semibold">Tout est à jour.</span> Aucune action prioritaire pour le moment.</div>}</section>; }

function ResourceGrid({ resources, view, open, star }: { resources: HomeResource[]; view: "grid" | "list"; open: (item: HomeResource) => void; star: (item: HomeResource) => void }) { return <div className={view === "grid" ? "mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "mt-5 space-y-2"}>{resources.map((item) => { const Icon = icons[item.key] || Boxes; return <article key={item.key} className="group flex min-h-[104px] items-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><button onClick={() => open(item)} className="flex min-w-0 flex-1 items-center text-left"><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${tones[item.tone] || tones.slate}`}><Icon size={24} /></span><span className="ml-4 min-w-0"><span className="block truncate text-sm font-semibold">{item.name}</span>{item.state === "unavailable" ? <span className="mt-1 block text-xs text-slate-400">Module non configuré</span> : item.state === "empty" ? <span className="mt-1 block text-xs text-slate-500">Aucune donnée pour le moment</span> : <><span className="mt-1 block text-xl font-bold">{formatNumber(item.count || 0)}</span><span className="block truncate text-[11px] text-slate-500">{item.label}</span></>}</span></button><button onClick={() => star(item)} aria-label={item.is_starred ? "Retirer des favoris" : "Ajouter aux favoris"} className={`rounded-full p-2 transition hover:bg-slate-100 ${item.is_starred ? "text-amber-500" : "text-slate-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}><Star size={17} fill={item.is_starred ? "currentColor" : "none"} /></button></article>; })}</div>; }

function SearchResults({ results, searching }: { results: HomeSearchResult[]; searching: boolean }) { return <div className="absolute right-4 top-[118px] z-40 w-[min(520px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl sm:right-7 lg:right-9 lg:top-[104px]">{searching ? <p className="p-4 text-sm text-slate-500">Recherche en cours…</p> : results.length ? results.map((item) => <a key={`${item.kind}-${item.id}`} href={item.href} className="flex items-center rounded-lg px-3 py-3 hover:bg-slate-50"><Search size={16} className="mr-3 text-slate-400" /><span><span className="block text-sm font-medium">{item.title}</span><span className="block text-xs text-slate-500">{item.subtitle || item.kind}</span></span></a>) : <p className="p-4 text-sm text-slate-500">Aucun résultat dans cette agence.</p>}</div>; }

function FloatingPanel({ title, close, children, wide }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) { return <div className={`fixed right-3 top-3 z-[80] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl ${wide ? "w-[min(390px,calc(100vw-24px))]" : "w-[min(310px,calc(100vw-24px))]"}`}><div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><h2 className="font-semibold">{title}</h2><button onClick={close} aria-label="Fermer"><X size={17} /></button></div>{children}</div>; }
function NotificationsPanel({ data, close, read, readAll }: { data: DashboardHome | null; close: () => void; read: (id: string) => void; readAll: () => void }) { const [unreadOnly, setUnreadOnly] = useState(true); const items = (data?.notifications || []).filter((item) => !unreadOnly || !item.is_read); return <FloatingPanel title="Notifications" close={close} wide><div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2"><button onClick={() => setUnreadOnly(true)} className={`rounded-md px-3 py-1.5 text-xs ${unreadOnly ? "bg-slate-100 font-semibold" : ""}`}>Non lues</button><button onClick={() => setUnreadOnly(false)} className={`rounded-md px-3 py-1.5 text-xs ${!unreadOnly ? "bg-slate-100 font-semibold" : ""}`}>Toutes</button>{!!data?.unread_count && <button onClick={readAll} className="ml-auto text-xs font-medium text-emerald-700">Tout lire</button>}</div>{items.length ? items.map((item: HomeNotification) => <button key={item.id} onClick={() => read(item.id)} className="block w-full border-b border-slate-100 px-5 py-4 text-left hover:bg-slate-50"><span className="flex items-center gap-2 text-sm font-semibold">{!item.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-1 block text-[11px] text-slate-400">{relativeDate(item.created_at)}</span></button>) : <EmptyPanel icon={Bell} text="Aucune notification pour le moment." />}</FloatingPanel>; }
function AccountPanel({ data, close, logout }: { data: DashboardHome | null; close: () => void; logout: () => void }) { return <FloatingPanel title="Compte" close={close}><div className="border-b border-slate-100 p-5"><p className="font-semibold">{data?.manager.name}</p><p className="mt-1 truncate text-xs text-slate-500">{data?.manager.email}</p><p className="mt-2 text-xs font-medium text-emerald-700">{data?.workspace.name}</p></div><MenuRow icon={UserRound} label="Mon compte" /><MenuRow icon={Users} label="Gérer l’équipe" /><MenuRow icon={Languages} label="Langue : Français" /><MenuRow icon={Settings} label="Préférences" /><button onClick={logout} className="flex w-full items-center gap-3 border-t border-slate-100 px-5 py-4 text-sm hover:bg-slate-50"><LogOut size={17} />Se déconnecter</button></FloatingPanel>; }
function HelpPanel({ close }: { close: () => void }) { return <FloatingPanel title="Aide et ressources" close={close}><MenuRow icon={LifeBuoy} label="Centre d’aide" /><MenuRow icon={MessageCircle} label="Contacter le support" /><MenuRow icon={BookOpen} label="Documentation API" /></FloatingPanel>; }
function MenuRow({ icon: Icon, label }: { icon: ComponentType<{ size?: number }>; label: string }) { return <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-slate-50"><Icon size={17} />{label}<ChevronRight size={15} className="ml-auto text-slate-400" /></button>; }
function EmptyPanel({ icon: Icon, text }: { icon: ComponentType<{ size?: number; className?: string }>; text: string }) { return <div className="px-6 py-16 text-center"><Icon className="mx-auto text-slate-300" size={28} /><p className="mt-3 text-sm text-slate-500">{text}</p></div>; }
function ErrorBanner({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="mt-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{message}</span><button onClick={retry} className="font-semibold underline">Réessayer</button></div>; }
function ResourceSkeleton() { return <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-[104px] animate-pulse rounded-xl border border-slate-200 bg-white p-4"><div className="h-14 w-14 rounded-xl bg-slate-100" /></div>)}</div>; }
function EmptyResources({ filter }: { filter: HomeFilter }) { return <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center"><Star className="mx-auto text-slate-300" /><h3 className="mt-3 font-semibold">{filter === "starred" ? "Aucun favori" : "Aucune activité récente"}</h3><p className="mt-1 text-sm text-slate-500">{filter === "starred" ? "Ajoutez une étoile à un module pour le retrouver ici." : "Vos modules récemment consultés apparaîtront ici."}</p></div>; }
function NoWorkspace() { return <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><Building2 className="mx-auto text-slate-300" size={38} /><h1 className="mt-5 text-xl font-semibold">Aucune agence configurée</h1><p className="mt-2 text-sm leading-6 text-slate-500">Créez ou rejoignez une organisation Slaivio pour commencer vos opérations.</p><Link href="/onboarding" className="mt-6 inline-flex rounded-lg bg-[#10b953] px-4 py-2.5 text-sm font-semibold text-white">Configurer mon agence</Link></div></div>; }
function formatNumber(value: number) { return new Intl.NumberFormat("fr-FR").format(value); }
function relativeDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `il y a ${minutes} min`; const hours = Math.round(minutes / 60); if (hours < 24) return `il y a ${hours} h`; return `il y a ${Math.round(hours / 24)} j`; }
