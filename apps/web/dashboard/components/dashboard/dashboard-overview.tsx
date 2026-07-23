"use client";

import { useClerk } from "@clerk/nextjs";
import {
  Bell, BookOpen, Boxes, ChevronDown, ChevronRight, CircleHelp, Grid2X2, HelpCircle,
  Home, Languages, LayoutList, LifeBuoy, LogOut, Menu, MessageSquareText, Package,
  Search, Settings, Share2, Star, Truck, UserRound, Users, X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";

import {
  getDashboardHome, markHomeNotificationRead, searchDashboardHome, updateHomeResource,
  type DashboardHome, type HomeNotification, type HomeResource, type HomeSearchResult,
} from "@/services/dashboard";

type Section = "home" | "starred" | "shared" | "workspaces";
type OpenPanel = "account" | "notifications" | "help" | null;

const resourceIcons = { clients: Users, dossiers: Boxes, shipments: Truck, packages: Package, inbox: MessageSquareText, reports: LayoutList };
const toneClasses: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700", blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700", amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700", slate: "bg-slate-100 text-slate-700",
};

export function DashboardOverviewPage() {
  const { signOut } = useClerk();
  const [data, setData] = useState<DashboardHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [section, setSection] = useState<Section>("home");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HomeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    getDashboardHome().then(setData).catch(() => setError("Impossible de charger votre espace. Réessayez.")).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchRef.current?.focus();
      }
      if (event.key === "Escape") { setPanel(null); setQuery(""); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchDashboardHome(query, controller.signal).then(setResults).catch(() => {}).finally(() => setSearching(false));
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  async function toggleStar(resource: HomeResource) {
    if (!data) return;
    const next = !resource.is_starred;
    setData({ ...data, resources: data.resources.map(item => item.key === resource.key ? { ...item, is_starred: next } : item) });
    try { await updateHomeResource(resource.key, { is_starred: next }); }
    catch { setData(data); setError("La modification du favori n’a pas été enregistrée."); }
  }

  async function openResource(resource: HomeResource) {
    if (!data) return;
    const now = new Date().toISOString();
    setData({ ...data, resources: data.resources.map(item => item.key === resource.key ? { ...item, last_opened_at: now } : item) });
    try { await updateHomeResource(resource.key, { opened: true }); }
    finally { window.location.assign(resource.href); }
  }

  async function readNotification(id: string) {
    if (!data) return;
    const target = data.notifications.find(item => item.id === id);
    if (!target || target.is_read) return;
    setData({ ...data, unread_count: Math.max(0, data.unread_count - 1), notifications: data.notifications.map(item => item.id === id ? { ...item, is_read: true } : item) });
    try { await markHomeNotificationRead(id); } catch { load(); }
  }

  const resources = useMemo(() => {
    if (!data) return [];
    const items = section === "starred" ? data.resources.filter(item => item.is_starred) : data.resources;
    return [...items].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "fr") : (b.last_opened_at || "").localeCompare(a.last_opened_at || ""));
  }, [data, section, sort]);

  return (
    <div className="h-dvh overflow-hidden bg-[#f7f8fa] text-[#1d1f25]">
      <Topbar compact={compact} query={query} setQuery={setQuery} searchRef={searchRef} data={data} panel={panel} setPanel={setPanel} setSidebarOpen={setSidebarOpen} />
      {(query.length >= 2 || searching) && <SearchPopover query={query} results={results} searching={searching} />}
      <div className="flex h-[calc(100dvh-57px)]">
        <Sidebar open={sidebarOpen} compact={compact} section={section} setSection={setSection} close={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-12">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-[28px] font-semibold tracking-[-0.035em]">{section === "starred" ? "Favoris" : section === "shared" ? "Partagés" : section === "workspaces" ? "Espaces de travail" : "Accueil"}</h1>
              <button onClick={() => setCompact(value => !value)} className="hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm md:block">{compact ? "Déployer le menu" : "Réduire le menu"}</button>
            </div>

            {section === "home" && <WelcomeBanner name={data?.manager.name} />}
            {error && <div role="alert" className="mt-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{error}</span><button onClick={load} className="font-semibold underline">Réessayer</button></div>}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button onClick={() => setSort(sort === "recent" ? "name" : "recent")} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-950">{sort === "recent" ? "Ouverts récemment" : "Nom"}<ChevronDown size={15} /></button>
              <div className="flex items-center gap-1">
                <button aria-label="Vue liste" onClick={() => setView("list")} className={`rounded-md p-2 ${view === "list" ? "bg-slate-200 text-slate-900" : "text-slate-500"}`}><LayoutList size={18} /></button>
                <button aria-label="Vue grille" onClick={() => setView("grid")} className={`rounded-md p-2 ${view === "grid" ? "bg-slate-200 text-slate-900" : "text-slate-500"}`}><Grid2X2 size={18} /></button>
              </div>
            </div>

            {loading ? <ResourceSkeleton /> : resources.length ? <ResourceGrid resources={resources} view={view} onOpen={openResource} onStar={toggleStar} /> : <EmptySection section={section} />}
          </div>
        </main>
      </div>
      {panel === "account" && <AccountPanel data={data} close={() => setPanel(null)} logout={() => signOut({ redirectUrl: "/sign-in" })} />}
      {panel === "notifications" && <NotificationsPanel data={data} close={() => setPanel(null)} read={readNotification} />}
      {panel === "help" && <HelpPanel close={() => setPanel(null)} />}
    </div>
  );
}

function Topbar({ compact, query, setQuery, searchRef, data, panel, setPanel, setSidebarOpen }: { compact: boolean; query: string; setQuery: Dispatch<SetStateAction<string>>; searchRef: RefObject<HTMLInputElement | null>; data: DashboardHome | null; panel: OpenPanel; setPanel: Dispatch<SetStateAction<OpenPanel>>; setSidebarOpen: Dispatch<SetStateAction<boolean>> }) {
  return <header className="relative z-40 flex h-[57px] items-center border-b border-[#d9dce1] bg-white px-3 sm:px-5">
    <button aria-label="Ouvrir le menu" onClick={() => setSidebarOpen(true)} className="mr-2 rounded-md p-2 hover:bg-slate-100 md:hidden"><Menu size={20} /></button>
    <div className={`flex shrink-0 items-center gap-2 ${compact ? "md:w-10" : "md:w-[235px]"}`}><Image src="/slaivio-icon-official.png" alt="" width={29} height={29} className="rounded-md" /><span className={`text-[19px] font-semibold tracking-tight ${compact ? "md:hidden" : ""}`}>Slaivio</span></div>
    <div className="absolute left-1/2 hidden w-[min(430px,38vw)] -translate-x-1/2 items-center rounded-full border border-[#d9dce1] bg-white px-4 py-2 shadow-sm sm:flex focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100"><Search size={16} className="text-slate-500" /><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} aria-label="Rechercher" placeholder="Rechercher dans Slaivio…" className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none" /><kbd className="text-xs text-slate-400">Ctrl K</kbd></div>
    <div className="ml-auto flex items-center gap-1"><button onClick={() => setPanel(panel === "help" ? null : "help")} className="hidden items-center gap-1 rounded-full px-3 py-2 text-sm hover:bg-slate-100 sm:flex"><CircleHelp size={16} /> Aide</button><button aria-label="Notifications" onClick={() => setPanel(panel === "notifications" ? null : "notifications")} className="relative rounded-full p-2.5 hover:bg-slate-100"><Bell size={18} />{!!data?.unread_count && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}</button><button aria-label="Compte" onClick={() => setPanel(panel === "account" ? null : "account")} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b8f8f] text-xs font-semibold text-white">{data?.manager.initials || "SL"}</button></div>
  </header>;
}

function Sidebar({ open, compact, section, setSection, close }: { open: boolean; compact: boolean; section: Section; setSection: Dispatch<SetStateAction<Section>>; close: () => void }) {
  const items: Array<{ key: Section; label: string; icon: typeof Home }> = [{ key: "home", label: "Accueil", icon: Home }, { key: "starred", label: "Favoris", icon: Star }, { key: "shared", label: "Partagés", icon: Share2 }, { key: "workspaces", label: "Espaces de travail", icon: Users }];
  return <><button aria-label="Fermer le menu" onClick={close} className={`fixed inset-0 z-40 bg-black/25 md:hidden ${open ? "block" : "hidden"}`} /><aside className={`fixed bottom-0 left-0 top-[57px] z-50 flex flex-col border-r border-[#d9dce1] bg-white transition-all md:relative md:top-0 md:z-auto ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${compact ? "w-[48px]" : "w-[250px]"}`}><button onClick={close} className="absolute right-2 top-2 rounded p-2 md:hidden"><X size={18} /></button><nav className="space-y-1 p-2 pt-3">{items.map(item => { const Icon = item.icon; return <button key={item.key} onClick={() => { setSection(item.key); close(); }} className={`flex min-h-10 w-full items-center gap-3 rounded px-3 text-sm font-medium ${section === item.key ? "bg-[#eef0f4] text-slate-950" : "text-slate-700 hover:bg-slate-50"}`}><Icon size={19} /><span className={compact ? "hidden" : ""}>{item.label}</span>{item.key === "workspaces" && !compact && <ChevronRight size={16} className="ml-auto" />}</button>; })}</nav><div className="mt-auto border-t border-slate-200 p-2"><button className="flex min-h-10 w-full items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50"><BookOpen size={18} /><span className={compact ? "hidden" : ""}>Ressources</span></button><button className="flex min-h-10 w-full items-center gap-3 rounded px-3 text-sm text-slate-700 hover:bg-slate-50"><Settings size={18} /><span className={compact ? "hidden" : ""}>Paramètres</span></button></div></aside></>;
}

function WelcomeBanner({ name }: { name?: string }) { const [visible, setVisible] = useState(true); if (!visible) return null; return <section className="relative mt-5 overflow-hidden rounded-lg border border-[#cad7df] bg-[#eef7fb] px-6 py-6 sm:px-10"><button aria-label="Fermer" onClick={() => setVisible(false)} className="absolute right-4 top-4 rounded p-1 hover:bg-white/60"><X size={17} /></button><div className="relative z-10 max-w-[650px]"><h2 className="text-[17px] font-semibold">Bienvenue {name?.split(" ")[0] || "dans Slaivio"}</h2><p className="mt-2 text-sm text-slate-700">Centralisez vos clients, dossiers, colis et expéditions dans un espace opérationnel conçu pour votre entreprise.</p><div className="mt-4 flex flex-wrap gap-3"><button className="rounded-full bg-[#20232b] px-5 py-2 text-sm font-semibold text-white hover:bg-black">Créer un dossier</button><button className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white/60">Découvrir Slaivio</button></div></div><div className="absolute -bottom-12 right-10 hidden h-36 w-36 rotate-12 rounded-3xl bg-gradient-to-br from-emerald-300 via-cyan-300 to-blue-500 opacity-55 blur-[1px] lg:block" /></section>; }

function ResourceGrid({ resources, view, onOpen, onStar }: { resources: HomeResource[]; view: "grid" | "list"; onOpen: (r: HomeResource) => void; onStar: (r: HomeResource) => void }) { return <div className={view === "grid" ? "mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "mt-4 space-y-2"}>{resources.map(resource => { const Icon = resourceIcons[resource.key as keyof typeof resourceIcons] || Boxes; return <article key={resource.key} className={`group relative flex items-center rounded-lg border border-[#d5d8dd] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:border-slate-400 hover:shadow-md ${view === "grid" ? "min-h-[94px] p-4" : "p-3"}`}><button onClick={() => onOpen(resource)} className="flex min-w-0 flex-1 items-center text-left"><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${toneClasses[resource.tone] || toneClasses.slate}`}><Icon size={25} /></span><span className="ml-4 min-w-0"><span className="block truncate text-sm font-semibold">{resource.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{resource.last_opened_at ? relativeDate(resource.last_opened_at) : resource.description}</span></span></button><button aria-label={resource.is_starred ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => onStar(resource)} className={`rounded-full p-2 opacity-100 hover:bg-slate-100 sm:opacity-0 sm:group-hover:opacity-100 ${resource.is_starred ? "text-amber-500 sm:opacity-100" : "text-slate-400"}`}><Star size={17} fill={resource.is_starred ? "currentColor" : "none"} /></button></article>; })}</div>; }

function SearchPopover({ query, results, searching }: { query: string; results: HomeSearchResult[]; searching: boolean }) { return <div className="fixed left-1/2 top-[52px] z-[60] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"><p className="px-3 py-2 text-xs font-semibold uppercase text-slate-400">Résultats pour “{query}”</p>{searching ? <p className="p-4 text-sm text-slate-500">Recherche…</p> : results.length ? results.map(item => <a key={`${item.kind}-${item.id}`} href={item.href} className="flex items-center rounded-lg px-3 py-3 hover:bg-slate-50"><Search size={16} className="mr-3 text-slate-400" /><span><span className="block text-sm font-medium">{item.title}</span><span className="block text-xs text-slate-500">{item.subtitle || item.kind}</span></span></a>) : <p className="p-4 text-sm text-slate-500">Aucun résultat réel trouvé.</p>}</div>; }

function FloatingPanel({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) { return <div className={`fixed right-3 top-[61px] z-[70] max-h-[calc(100dvh-70px)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,.2)] ${wide ? "w-[min(360px,calc(100vw-24px))]" : "w-[min(300px,calc(100vw-24px))]"}`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold">{title}</h2><button aria-label="Fermer" onClick={close}><X size={16} /></button></div>{children}</div>; }
function AccountPanel({ data, close, logout }: { data: DashboardHome | null; close: () => void; logout: () => void }) { return <FloatingPanel title="Compte" close={close}><div className="p-4"><p className="font-semibold">{data?.manager.name}</p><p className="truncate text-xs text-slate-500">{data?.manager.email}</p><p className="mt-1 truncate text-xs text-slate-400">{data?.workspace.name}</p></div><MenuRow icon={UserRound} label="Mon compte" /><MenuRow icon={Users} label="Gérer l’équipe" /><MenuRow icon={Languages} label="Langue : Français" /><MenuRow icon={Settings} label="Préférences" /><div className="my-2 border-t border-slate-100" /><button onClick={logout} className="flex w-full items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50"><LogOut size={17} />Se déconnecter</button></FloatingPanel>; }
function NotificationsPanel({ data, close, read }: { data: DashboardHome | null; close: () => void; read: (id: string) => void }) { const [tab, setTab] = useState<"unread" | "all">("unread"); const items = (data?.notifications || []).filter((item: HomeNotification) => tab === "all" || !item.is_read); return <FloatingPanel title="Notifications" close={close} wide><div className="flex gap-1 border-b border-slate-100 px-4 py-2"><button onClick={() => setTab("unread")} className={`rounded-md px-3 py-1.5 text-xs ${tab === "unread" ? "bg-slate-100 font-semibold" : ""}`}>Non lues</button><button onClick={() => setTab("all")} className={`rounded-md px-3 py-1.5 text-xs ${tab === "all" ? "bg-slate-100 font-semibold" : ""}`}>Toutes</button></div>{items.length ? items.map((item: HomeNotification) => <button key={item.id} onClick={() => read(item.id)} className="block w-full border-b border-slate-100 px-5 py-4 text-left hover:bg-slate-50"><span className="flex items-center gap-2 text-sm font-semibold">{!item.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-1 block text-[11px] text-slate-400">{relativeDate(item.created_at)}</span></button>) : <div className="px-6 py-16 text-center"><Bell className="mx-auto text-slate-300" /><p className="mt-3 text-sm text-slate-500">Aucune notification {tab === "unread" ? "non lue" : ""}.</p></div>}</FloatingPanel>; }
function HelpPanel({ close }: { close: () => void }) { return <FloatingPanel title="Aide et ressources" close={close}><MenuRow icon={LifeBuoy} label="Centre d’aide" /><MenuRow icon={MessageSquareText} label="Contacter le support" /><MenuRow icon={HelpCircle} label="Raccourcis clavier" /><MenuRow icon={BookOpen} label="Documentation API" /></FloatingPanel>; }
function MenuRow({ icon: Icon, label }: { icon: ComponentType<{ size?: number; className?: string }>; label: string }) { return <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-slate-50"><Icon size={17} className="text-slate-600" />{label}<ChevronRight size={15} className="ml-auto text-slate-400" /></button>; }
function ResourceSkeleton() { return <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(item => <div key={item} className="h-[94px] animate-pulse rounded-lg border border-slate-200 bg-white p-4"><div className="h-14 w-14 rounded-xl bg-slate-100" /></div>)}</div>; }
function EmptySection({ section }: { section: string }) { return <div className="mt-16 text-center"><Star className="mx-auto text-slate-300" size={32} /><h2 className="mt-4 font-semibold">Aucun élément ici</h2><p className="mt-1 text-sm text-slate-500">{section === "starred" ? "Ajoutez des éléments aux favoris depuis l’accueil." : "Cet espace se remplira avec les données de votre organisation."}</p></div>; }
function relativeDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return "Ouvert récemment"; const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `Ouvert il y a ${minutes} min`; const hours = Math.round(minutes / 60); if (hours < 24) return `Ouvert il y a ${hours} h`; return `Ouvert il y a ${Math.round(hours / 24)} j`; }
