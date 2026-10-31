"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import { PlatformAdminEntry } from '@/components/platform/platform-admin-entry';
import { SessionRecoveryPrompt } from '@/components/auth/session-recovery-prompt';
import {memberLanding} from '@/config/member-access';

import { useClerk, useUser } from "@clerk/nextjs";
import { accountDisplayName } from "./account-identity";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Home,
  LayoutDashboard,
  Keyboard,
  Languages,
  LogOut,
  Menu,
  MessageSquareText,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { usePermissions } from "@/components/permissions/permission-provider";

import { WorkspaceSearch } from "@/components/layout/workspace-search";
import { OrganizationSwitcher } from "@/components/tenant/organization-switcher";
import { OfficeContextSelector } from "@/components/tenant/office-context-selector";
import { canAccessRoute, getAppNavigation, getCompactPrimaryRoutes, type AppRoute } from "@/config/app-navigation";
import { getOrganizationProductProfile, getProductProfile, usesCompactAgencyShell } from "@/config/product-profile";
import { SESSION_EXPIRED_EVENT,MFA_REQUIRED_EVENT } from "@/services/api";
import { listNotifications } from "@/services/notification-center";
import { NotificationsMenu } from "@/components/notifications/notifications-menu";
import { TrialBanner } from "@/components/layout/trial-banner";
import { SlaivioBrand } from "@/components/ui/slaivio-brand";
import { SlaivioLogoLoader } from "@/components/ui/slaivio-logo-loader";
import { PilotOfflineIndicator } from "@/components/offline/pilot-offline-indicator";
import { PilotReadinessPanel } from "@/components/dashboard/pilot-readiness";
import { dashboardLabel, setDashboardLocale,setAgencyDashboardLocale, useDashboardLocale } from "@/components/i18n/dashboard-language";
import { getTenantContext } from "@/services/tenant";
import { createTicket, listArticles } from "@/services/support";

type FloatingPanel = "account" | "notifications" | "help" | "language" | null;
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const utilityRoutes: readonly AppRoute[] = [
  { label: "Assistant Slaivio", href: "/app/assistant", icon: Sparkles, keywords: ["assistant", "ia", "automatisation", "escalade"] },
  { label: "Paramètres", href: "/app/settings", icon: Settings, permission: "organization.read", keywords: ["organisation", "équipe", "rôle", "sécurité", "paramètres"] },
  { label: "Centre d’aide", href: "/app/support", icon: CircleHelp, permission: "support.read", keywords: ["aide", "support", "ticket", "documentation"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  useDashboardMessages();
  const locale = useDashboardLocale();
  const [productProfile, setProductProfile] = useState(getProductProfile);
  const [workspaceKind,setWorkspaceKind]=useState("OFFICE");
  const pilot = usesCompactAgencyShell(productProfile);
  const cargo = productProfile === "PARCEL_FREIGHT";
  const appNavigation = useMemo(() => getAppNavigation(productProfile, workspaceKind), [productProfile,workspaceKind]);
  const searchableAppRoutes = useMemo(() => appNavigation.flatMap((group) => group.routes), [appNavigation]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reportsView = pathname === "/app/reports" || pathname.startsWith("/app/reports/");
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const { permissions, loading: permissionsLoading, available: permissionsAvailable,roleCode } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [mfaRequired,setMfaRequired]=useState(false);
  const mfaPromptShown=useRef(false);
  const [floatingPanel, setFloatingPanel] = useState<FloatingPanel>(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    pilot ? { Opérations: true } : { Clients: false, Opérations: true, "Offre commerciale": false, Communication: false, Pilotage: false },
  );

  useEffect(() => {
    let active = true;
    getTenantContext()
      .then((context) => {
        if (active) {setProductProfile(getOrganizationProductProfile(context.active_tenant?.organization_type));setWorkspaceKind(context.active_tenant?.workspace_kind || "OFFICE");setAgencyDashboardLocale(context.active_tenant?.language_code==='en'?'en':'fr');}
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const groupedRoutes = useMemo(
    () => appNavigation.map((group) => ({
      ...group,
      routes: group.routes.filter((route) => canAccessRoute(route, permissions, permissionsAvailable)),
    })).filter((group) => group.routes.length),
    [appNavigation, permissions, permissionsAvailable],
  );

  const pilotPrimaryRoutes = useMemo(() => {
    return getCompactPrimaryRoutes(
      groupedRoutes.flatMap((group) => group.routes),
      productProfile,
    );
  }, [groupedRoutes, productProfile]);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    const routes = [...searchableAppRoutes, ...utilityRoutes].filter((route) =>
      canAccessRoute(route, permissions, permissionsAvailable),
    );
    if (!normalized) return routes;
    return routes.filter((route) =>
      [route.label, ...route.keywords].some((term) => term.toLocaleLowerCase("fr").includes(normalized)),
    );
  }, [query, permissions, permissionsAvailable, searchableAppRoutes]);

  useEffect(() => {
    if (pilot) {
      document.documentElement.dataset.theme = "light";
      return;
    }
    const theme = window.localStorage.getItem("slaivio.theme") || "light";
    document.documentElement.dataset.theme = theme;
  }, [pilot]);

  useEffect(() => {
    if (pilot) {
      setSidebarCollapsed(false);
      if (!cargo) return;
    }
    const savedCollapsed = window.localStorage.getItem("slaivio.sidebar.collapsed");
    const savedGroups = window.localStorage.getItem("slaivio.sidebar.groups");
    if (!pilot) setSidebarCollapsed(savedCollapsed === "1");
    if (savedGroups) {
      try {
        const parsed = JSON.parse(savedGroups) as Record<string, boolean>;
        if (cargo) {
          const selected = appNavigation.find((group) => parsed[group.label])?.label || appNavigation[0]?.label;
          setOpenGroups(Object.fromEntries(appNavigation.map((group) => [group.label, group.label === selected])));
          return;
        }
        const selected = appNavigation.find((group) => parsed[group.label])?.label || "Opérations";
        setOpenGroups(Object.fromEntries(appNavigation.map((group) => [group.label, group.label === selected])));
      } catch { /* Ignore stale preferences. */ }
    }
  }, [appNavigation, pilot, cargo]);

  useEffect(() => {
    if (pilot && !cargo) return;
    const activeGroup = groupedRoutes.find((group) =>
      group.routes.some((route) => isNavigationRouteActive(pathname, searchParams, route.href)),
    );
    if (!activeGroup) return;
    setOpenGroups((current) => {
      const next = Object.fromEntries(groupedRoutes.map((group) => [group.label, group.label === activeGroup.label]));
      return Object.keys(next).every((key) => current[key] === next[key]) ? current : next;
    });
  }, [groupedRoutes, pathname, searchParams, pilot, cargo]);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((!pilot || cargo) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setFloatingPanel(null);
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [pilot, cargo]);

  useEffect(() => {
    const onSessionExpired = () => setSessionExpired(true);
    const onMfaRequired=()=>{if(!mfaPromptShown.current){mfaPromptShown.current=true;setMfaRequired(true);}};
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    window.addEventListener(MFA_REQUIRED_EVENT,onMfaRequired);
    return () => {window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);window.removeEventListener(MFA_REQUIRED_EVENT,onMfaRequired);};
  }, []);

  useEffect(() => {
    if (!cargo) return;
    let active = true;
    listNotifications({ page: 1, page_size: 1 }).then((result) => {
      if (active) setHasUnreadNotifications(result.stats.unread > 0);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [cargo]);

  function openRoute(href: string) {
    setSearchOpen(false);
    setQuery("");
    setMobileOpen(false);
    router.push(href);
  }

  function togglePanel(panel: Exclude<FloatingPanel, null>) {
    setFloatingPanel((current) => current === panel ? null : panel);
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("slaivio.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }

  function toggleGroup(label: string) {
    setOpenGroups((current) => {
      const willOpen = current[label] === false;
      const next = Object.fromEntries(groupedRoutes.map((group) => [group.label, willOpen && group.label === label]));
      window.localStorage.setItem("slaivio.sidebar.groups", JSON.stringify(next));
      return next;
    });
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      window.localStorage.setItem("slaivio.sidebar.collapsed", "0");
    }
  }

  return (
    <div className={`slaivio-app-shell flex h-dvh overflow-hidden bg-white text-[#25292e] ${pilot ? "slaivio-pilot" : ""}`}>
      <button
        aria-label={dashboardText("Fermer la navigation")}
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-black/25 lg:hidden ${mobileOpen ? "block" : "hidden"}`}
      />

      <aside data-ui="sidebar" className={`slaivio-sidebar fixed inset-y-0 left-0 z-50 flex w-[292px] shrink-0 flex-col ${cargo ? "" : "border-r border-[#e8eaed]"} bg-white transition-[width,transform] duration-200 lg:relative lg:z-auto lg:translate-x-0 ${cargo ? sidebarCollapsed ? "lg:w-[56px]" : "lg:w-[240px]" : pilot ? "lg:w-[232px]" : sidebarCollapsed ? "lg:w-[56px]" : "lg:w-[248px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex h-[60px] shrink-0 items-center ${cargo ? sidebarCollapsed ? "justify-center px-1" : "justify-between px-4" : `border-b ${pilot ? "border-0 px-3" : `border-[#e3e4e5] ${sidebarCollapsed ? "justify-center px-1" : "px-4"}`}`}`}>
          {cargo ? <Link href="/app" className={`flex min-w-0 items-center gap-2 ${sidebarCollapsed ? "lg:hidden" : ""}`} onClick={() => setMobileOpen(false)}><SlaivioBrand compact iconOnly /><span className="text-[14px] font-semibold leading-5 text-[#20252b]">{dashboardText("Slaivio")}</span></Link> : pilot ? <div className="min-w-0 flex-1"><OrganizationSwitcher menuPlacement="down" /></div> : <Link href="/app" className={`flex items-center ${sidebarCollapsed?"lg:hidden":""}`} onClick={() => setMobileOpen(false)}><SlaivioBrand compact iconOnly={sidebarCollapsed}/></Link>}
          <button onClick={() => setMobileOpen(false)} aria-label={dashboardText("Fermer")} className="ml-auto rounded-[4px] p-1.5 text-[#555] hover:bg-[#f0f1f1] lg:hidden">
            <X size={17} />
          </button>
          {(!pilot || cargo) && <button onClick={toggleSidebar} aria-label={sidebarCollapsed ? dashboardText("Agrandir la navigation") : dashboardText("Réduire la navigation")} title={sidebarCollapsed ? dashboardText("Agrandir la navigation") : dashboardText("Réduire la navigation")} className={`ml-auto hidden h-8 w-8 place-items-center rounded-[5px] text-[#656c74] hover:bg-[#f0f1f1] lg:grid ${sidebarCollapsed ? "lg:mx-auto lg:border lg:border-[#dfe1e3] lg:bg-white lg:shadow-sm" : ""}`}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>}
        </div>

        <nav className={`min-h-0 flex-1 overflow-y-auto ${pilot && !cargo ? "px-3 py-3" : `py-2.5 ${cargo ? sidebarCollapsed ? "px-2 pb-5 pt-5" : "px-3 pb-5 pt-5" : sidebarCollapsed ? "lg:px-2" : "px-3"}`}`} aria-label={dashboardText("Navigation Slaivio")}>
          {pilot && !cargo ? (
            <div>
              <PilotRailLink href="/app" icon={<Home size={19} />} active={pathname === "/app"} label={dashboardLabel(locale, dashboardText("Accueil"), "/app")} />
              {pilotPrimaryRoutes.map((route) => (
                <PilotRailLink
                  key={route.href}
                  href={route.href}
                  icon={<route.icon size={19} />}
                  active={isNavigationRouteActive(pathname, searchParams, route.href)}
                  label={pilotRouteLabel(locale, route.label, route.href)}
                />
              ))}
            </div>
          ) : cargo ? <>
            <div aria-hidden="true" className="mb-4 border-t border-[#e8eaed]" />
            {permissionsAvailable&&memberLanding(permissions,roleCode)==='/app'&&<CargoSidebarLink href="/app" icon={<LayoutDashboard size={17}/>} active={pathname === "/app"} label={dashboardText("Tableau de bord")} collapsed={sidebarCollapsed}/>}
            <div className="mt-2 space-y-2">
              {groupedRoutes.flatMap(group => group.routes).map(route => <CargoSidebarLink key={route.href} href={route.href} icon={cargoSidebarIcon(route.href, route.label)} active={isNavigationRouteActive(pathname, searchParams, route.href)} label={dashboardLabel(locale, route.label, route.href)} collapsed={sidebarCollapsed}/>) }
            </div>
          </> : <>
            <SidebarLink href="/app" icon={<Home size={18} />} active={pathname === "/app"} label={cargo ? dashboardText("Dashboard") : dashboardLabel(locale, dashboardText("Accueil"), "/app")} collapsed={sidebarCollapsed} />
            {groupedRoutes.map((group) => group.collapsible === false && group.routes[0] ? (
            <div key={group.label} className="mt-1">
              <SidebarLink
                href={group.routes[0].href}
                icon={<group.icon size={18} />}
                active={isNavigationRouteActive(pathname, searchParams, group.routes[0].href)}
                label={dashboardLabel(locale, group.routes[0].label, group.routes[0].href)}
                collapsed={sidebarCollapsed}
              />
            </div>
          ) : (
            <section data-ui="sidebar-group" key={group.label} className={sidebarCollapsed ? "mt-1" : "mt-3"}>
              <button type="button" onClick={() => toggleGroup(group.label)} title={sidebarCollapsed ? dashboardLabel(locale, group.label) : undefined} aria-expanded={!sidebarCollapsed && openGroups[group.label] !== false} className={`flex w-full items-center text-[#30373d] hover:text-[#20252b] ${cargo ? "h-10 gap-3 px-2.5" : sidebarCollapsed ? "h-10 justify-center rounded-[6px] hover:bg-[#f0f2f3]" : "h-9 gap-2.5 px-2"}`}>
                <group.icon size={16} strokeWidth={1.8} className="shrink-0 text-[#69747f]" />
                {!sidebarCollapsed && <><span data-ui="sidebar-group-label" className={`truncate ${cargo ? "text-[14px] font-semibold" : "text-[12px] font-[650] uppercase tracking-[0.045em]"}`}>{dashboardLabel(locale, group.label)}</span><ChevronDown size={14} className={`ml-auto text-[#8a939c] transition-transform ${openGroups[group.label] === false ? "-rotate-90" : ""}`} /></>}
              </button>
              <div className={`ml-[17px] space-y-1 border-l border-[#e2e6e9] pl-2.5 ${sidebarCollapsed || openGroups[group.label] === false ? "hidden" : ""}`}>
                {group.routes.map((route) => (
                  <SidebarLink
                    key={route.href}
                    href={route.href}
                    icon={<route.icon size={16} />}
                    active={isNavigationRouteActive(pathname, searchParams, route.href)}
                    label={dashboardLabel(locale, route.label, route.href)}
                    collapsed={sidebarCollapsed}
                    nested
                  />
                ))}
              </div>
            </section>
            ))}
          </>}
        </nav>

        {cargo && canAccessRoute(utilityRoutes.find(route => route.href === "/app/settings")!, permissions, permissionsAvailable) && <div className={`shrink-0 py-3 ${sidebarCollapsed ? "px-2" : "px-3"}`}><div aria-hidden="true" className="mb-3 border-t border-[#e8eaed]"/><CargoSidebarLink href="/app/settings" icon={<Settings size={17}/>} active={isNavigationRouteActive(pathname, searchParams, "/app/settings")} label={dashboardText("Paramètres")} collapsed={sidebarCollapsed}/></div>}
        {pilot && !cargo && <div className="mt-auto flex shrink-0 items-center px-3 pb-3 lg:grid lg:px-0 lg:pb-0">
          <PilotRailButton label={dashboardLabel(locale, dashboardText("Notifications"))} icon={<Bell size={19} />} onClick={() => togglePanel("notifications")} active={floatingPanel === "notifications"} />
          <AccountTrigger onClick={() => togglePanel("account")} rail />
        </div>}

        {!pilot && !cargo && <div className={`shrink-0 border-t border-[#e3e4e5] ${sidebarCollapsed ? "lg:p-1.5" : "p-3"}`}>
          {!permissionsLoading && !permissionsAvailable && (
            <div className="mb-2 rounded-[5px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
              {dashboardText("Les droits n’ont pas pu être chargés. Les API continuent de protéger les actions.")}</div>
          )}
          <OrganizationSwitcher collapsed={sidebarCollapsed} />
          <OfficeContextSelector collapsed={sidebarCollapsed} />
        </div>}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header data-ui="topbar" className={`slaivio-topbar relative z-30 flex h-[60px] shrink-0 items-center max-sm:has-[[data-trial-banner]]:h-[96px] max-sm:has-[[data-trial-banner]]:pb-9 ${cargo ? "" : "border-b border-[#dfe1e3]"} bg-white px-3 sm:px-5 lg:px-8`}>
          <button onClick={() => setMobileOpen(true)} aria-label={dashboardText("Ouvrir la navigation")} className="mr-2 rounded-[5px] p-2 text-[#5f666e] hover:bg-[#f0f1f1] lg:hidden">
            <Menu size={19} />
          </button>

          {!pilot && <button
            onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); }}
            className="mr-2 hidden h-9 w-[min(360px,28vw)] min-w-9 shrink items-center rounded-[6px] border border-[#d7dade] bg-[#f8f8f7] px-3 text-left hover:border-[#bfc3c7] md:flex"
            aria-label={dashboardText("Ouvrir la recherche")}
          >
            <Search size={15} className="text-[#656c74]" />
            <span className="ml-2 min-w-0 flex-1 truncate text-[13px] text-[#777e86]">{dashboardText("Rechercher dans Slaivio")}</span>
            <kbd className="rounded border border-[#d8dade] bg-white px-1.5 py-0.5 text-[10px] text-[#737981]">{dashboardText("Ctrl K")}</kbd>
          </button>}

          {cargo && <button type="button" onClick={() => setSearchOpen(true)} aria-label={locale === "en" ? "Search Slaivio" : dashboardText("Rechercher dans Slaivio")} className="mr-2 flex h-9 min-w-9 items-center gap-2 rounded-md border border-[#d7dade] bg-white px-2 text-sm text-[#656c74] hover:bg-[#f8faf9] sm:w-[min(360px,28vw)] sm:px-3"><Search size={16}/><span className="hidden min-w-0 flex-1 truncate text-left sm:block">{locale === "en" ? "Search Slaivio…" : dashboardText("Rechercher dans Slaivio…")}</span><kbd className="hidden text-[10px] lg:block">{dashboardText("Ctrl K")}</kbd></button>}
          <TrialBanner/>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {cargo && <OrganizationSwitcher header menuPlacement="down" />}
            {pilot && !cargo && <PilotReadinessPanel compact />}
            {!pilot && !cargo && <HeaderButton label={dashboardText("Assistant")} icon={<Sparkles size={16} />} onClick={() => router.push("/app/assistant")} active={pathname.startsWith("/app/assistant")} showLabel />}
            {(cargo || !pilot) && <HeaderButton label={dashboardText("Aide")} icon={<CircleHelp size={16} />} onClick={() => togglePanel("help")} active={floatingPanel === "help"} showLabel={!cargo} />}
            {!cargo && <HeaderButton label={dashboardLabel(locale, dashboardText("Langue"))} icon={<Languages size={16} />} onClick={() => togglePanel("language")} active={floatingPanel === "language"} showLabel />}
            {(cargo || !pilot) && (!permissionsAvailable || permissions.includes("notifications.read")) && <HeaderButton label={dashboardLabel(locale, dashboardText("Notifications"))} icon={<span className="relative inline-flex"><Bell size={16} />{cargo && hasUnreadNotifications && <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#e5484d] ring-2 ring-white" />}</span>} onClick={() => togglePanel("notifications")} active={floatingPanel === "notifications"} />}
            {(cargo || !pilot) && <AccountTrigger onClick={() => togglePanel("account")} />}
          </div>
        </header>

        {floatingPanel && <button aria-label={dashboardText("Fermer le menu")} className="fixed inset-0 z-40 cursor-default" onClick={() => setFloatingPanel(null)} />}
        {floatingPanel === "help" && <div className="fixed right-[82px] top-[52px] z-50"><HelpMenu close={() => setFloatingPanel(null)} /></div>}
        {floatingPanel === "notifications" && <div className={`fixed z-50 ${pilot && !cargo ? "bottom-[70px] left-3 lg:left-[96px]" : "right-[48px] top-[52px]"}`}><NotificationsMenu close={() => setFloatingPanel(null)} /></div>}
        {floatingPanel === "language" && <div className="fixed right-[82px] top-[52px] z-50"><LanguageMenu close={() => setFloatingPanel(null)}/></div>}
        {floatingPanel === "account" && <div className={`fixed z-50 ${pilot && !cargo ? "bottom-3 left-3 lg:left-[96px]" : "right-3 top-[52px]"}`}><AccountMenu close={() => setFloatingPanel(null)} /></div>}


        {pilot && <PilotOfflineIndicator />}
        <main className={`slaivio-operations min-h-0 min-w-0 flex-1 bg-white ${reportsView ? "overflow-hidden" : "overflow-y-auto"}`}>
          {pilot ? <div className={`w-full bg-white ${reportsView ? "h-full min-h-0" : "min-h-full"}`}>{children}</div> : children}
        </main>
      </section>

      {cargo && searchOpen && <WorkspaceSearch locale={locale} close={() => setSearchOpen(false)}/>}
      {!pilot && searchOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/25 px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={dashboardText("Recherche Slaivio")} onMouseDown={(event) => { if (event.currentTarget === event.target) setSearchOpen(false); }}>
          <div className="w-full max-w-xl overflow-hidden rounded-[8px] border border-[#cfd2d5] bg-white shadow-2xl">
            <label className="flex h-12 items-center border-b border-[#e6e7e8] px-4">
              <Search size={17} className="text-[#6b727a]" />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) openRoute(results[0].href); }} placeholder={dashboardText("Clients, dossiers, colis, expéditions...")} className="ml-3 min-w-0 flex-1 bg-transparent text-[14px] outline-none" autoComplete="off" />
              <kbd className="text-[11px] text-[#7a8087]">{dashboardText("Esc")}</kbd>
            </label>
            <div className="max-h-80 overflow-y-auto p-2">
              {!results.length && <p className="px-3 py-8 text-center text-sm text-[#777]">{dashboardText("Aucun résultat.")}</p>}
              {results.map((route) => (
                <button key={route.href} onClick={() => openRoute(route.href)} className="flex w-full items-center gap-3 rounded-[5px] px-3 py-2.5 text-left text-sm hover:bg-[#f0f1f1] focus:bg-[#f0f1f1] focus:outline-none">
                  <route.icon size={16} className="text-[#606871]" />
                  <span>{dashboardLabel(locale, route.label, route.href)}</span>
                  <ChevronRight size={14} className="ml-auto text-[#9aa0a6]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mfaRequired && clerkEnabled && <MfaPolicyPrompt close={()=>setMfaRequired(false)}/>}
      {sessionExpired && <SessionRecoveryPrompt returnTo={pathname}/>}
    </div>
  );
}

function MfaPolicyPrompt({close}:{close:()=>void}){
  useDashboardMessages();
  const clerk=useClerk();
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" role="alertdialog" aria-modal="true" aria-labelledby="agency-mfa-title"><section className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"><h2 id="agency-mfa-title" className="text-lg font-semibold">{dashboardText("Double authentification requise")}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{dashboardText("Votre agence exige une vérification supplémentaire à la connexion. Activez-la dans la sécurité de votre compte, puis reconnectez-vous.")}</p><button type="button" onClick={()=>{close();clerk.openUserProfile();}} className="mt-4 h-10 w-full rounded-lg border border-slate-300 text-sm">{dashboardText("Configurer mon compte")}</button><button type="button" onClick={()=>void clerk.signOut({redirectUrl:'/sign-in'})} className="mt-2 h-10 w-full rounded-lg bg-slate-900 text-sm font-medium text-white">{dashboardText("Se reconnecter")}</button></section></div>;
}

function CargoSidebarLink({ href, icon, active, label, collapsed = false }: { href: string; icon: ReactNode; active: boolean; label: string; collapsed?: boolean }) {
  useDashboardMessages();
  return (
    <Link data-ui="cargo-sidebar-link" data-active={active ? "true" : "false"} href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={`flex min-h-[42px] items-center rounded-[6px] text-[13px] tracking-[-0.005em] ${collapsed ? "justify-center px-1" : "gap-2.5 px-2.5"} ${active ? "bg-[#dcefe8] font-semibold text-[#145f49]" : "bg-[#f2f2f2] font-normal text-[#3f474f] hover:bg-[#e9eeec] hover:text-[#20252b]"}`}>
      <span className={active ? "text-[#16855f]" : "text-[#5d6871]"}>{icon}</span>
      {!collapsed && <span className="truncate">{dashboardText(label)}</span>}
    </Link>
  );
}

function cargoSidebarIcon(href: string, label: string): ReactNode {
  if (href.includes("settings")) return <Settings size={17} />;
  if (/client/i.test(label) || href.includes("clients")) return <Users size={17} />;
  if (/communication|messag|inbox/i.test(label) || /inbox|communication|messages/.test(href)) return <MessagesSquare size={17} />;
  if (/finance|paiement/i.test(label) || /finance|payment/.test(href)) return <Wallet size={17} />;
  if (/rapport|report/i.test(label) || href.includes("reports")) return <BarChart3 size={17} />;
  if (/gestion|admin/i.test(label) || href.includes("admin")) return <SlidersHorizontal size={17} />;
  if (/op[eé]ration|colis|exp[eé]di/i.test(label) || /operations|packages|shipments/.test(href)) return <Package size={17} />;
  return <Home size={17} />;
}

function SidebarLink({ href, icon, active, label, collapsed = false, nested = false }: { href: string; icon: ReactNode; active: boolean; label: string; collapsed?: boolean; nested?: boolean }) {
  useDashboardMessages();
  return (
    <Link data-ui="sidebar-link" data-active={active ? "true" : "false"} href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={`flex min-h-[38px] items-center rounded-[6px] text-[14px] tracking-[-0.005em] ${collapsed ? "justify-center px-1" : nested ? "px-3" : "gap-2.5 px-2.5"} ${active ? "bg-[#e4f4ee] font-[630] text-[#145f49]" : "font-[460] text-[#3f474f] hover:bg-[#f2f4f4] hover:text-[#20252b]"}`}>
      {(!nested || collapsed) && <span className={active ? "text-[#16855f]" : "text-[#656c74]"}>{icon}</span>}
      {!collapsed && <span className="truncate">{dashboardText(label)}</span>}
    </Link>
  );
}

function isNavigationRouteActive(pathname: string, searchParams: URLSearchParams, href: string) {
  const url = new URL(href, "https://slaivio.local");
  if (pathname !== url.pathname && !pathname.startsWith(`${url.pathname}/`)) return false;
  if (url.pathname === "/app/settings" && url.searchParams.size === 0 && searchParams.has("section")) return false;
  for (const [key, value] of url.searchParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

function PilotRailLink({ href, icon, active, label }: { href: string; icon: ReactNode; active: boolean; label: string }) {
  useDashboardMessages();
  return (
    <Link
      data-ui="sidebar-link"
      data-active={active ? "true" : "false"}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group mb-1 flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] ${active ? "bg-[#edf4f0] font-medium text-[#145f49]" : "font-normal text-[#4b545c] hover:bg-[#f5f6f7] hover:text-[#20252b]"}`}
    >
      <span className={active ? "text-[#16855f]" : "text-[#656c74] group-hover:text-[#3f474f]"}>{icon}</span>
      <span className="truncate">{dashboardText(label)}</span>
    </Link>
  );
}

function PilotRailButton({ icon, active, label, onClick }: { icon: ReactNode; active: boolean; label: string; onClick: () => void }) {
  useDashboardMessages();
  return <button type="button" onClick={onClick} aria-label={dashboardText(label)} aria-expanded={active} title={dashboardText(label)} className={`group mx-3 flex h-10 w-[calc(100%-24px)] items-center gap-3 rounded-lg px-3 text-[13px] ${active ? "bg-[#e4f4ee] text-[#145f49]" : "text-[#656c74] hover:bg-[#f2f4f4] hover:text-[#20252b]"}`}>{icon}<span>{dashboardText(label)}</span></button>;
}

function pilotRouteLabel(locale: "fr" | "en", fallback: string, href: string) {
  const labels: Record<string, { fr: string; en: string }> = {
    "/app/dossiers": { fr: "Dossiers", en: "Cases" },
    "/app/inbox": { fr: "Messages", en: "Messages" },
    "/app/followups": { fr: "Relances", en: "Follow-ups" },
    "/app/knowledge": { fr: "Connaissances", en: "Knowledge" },
  };
  return dashboardText(labels[href]?.[locale] || dashboardLabel(locale, fallback, href));
}

function HeaderButton({ label, icon, onClick, active = false, showLabel = false }: { label: string; icon: ReactNode; onClick: () => void; active?: boolean; showLabel?: boolean }) {
  useDashboardMessages();
  return (
    <button type="button" onClick={onClick} aria-label={dashboardText(label)} aria-expanded={active} className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[5px] px-2 text-[13px] ${active ? "bg-[#eceeef]" : "hover:bg-[#f0f1f1]"}`}>
      {icon}{showLabel && <span className="hidden sm:inline">{dashboardText(label)}</span>}
    </button>
  );
}

function AccountTrigger({ onClick, rail = false }: { onClick: () => void; rail?: boolean }) {
  useDashboardMessages();
  if (!clerkEnabled) {
    return <FallbackAccountTrigger onClick={onClick} rail={rail} />;
  }
  return <ClerkAccountTrigger onClick={onClick} rail={rail} />;
}

function ClerkAccountTrigger({ onClick, rail }: { onClick: () => void; rail: boolean }) {
  useDashboardMessages();
  const { user } = useUser();
  const name = accountDisplayName(user);
  return (
    <button type="button" onClick={onClick} aria-label={dashboardText("Compte")} className={rail ? "flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-none text-[10px] leading-3 text-[#4b545c] hover:bg-[#f2f4f4]" : "ml-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#087a46] text-[12px] font-semibold text-white ring-1 ring-black/5"}>
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#087a46] text-[12px] font-semibold text-white ring-1 ring-black/5"><UserAvatar imageUrl={user?.imageUrl} name={name} size={32} /></span>
    </button>
  );
}

function AccountMenu({ close }: { close: () => void }) {
  useDashboardMessages();
  if (!clerkEnabled) {
    return <FallbackAccountMenu close={close} />;
  }
  return <ClerkAccountMenu close={close} />;
}

function ClerkAccountMenu({ close }: { close: () => void }) {
  useDashboardMessages();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const name = accountDisplayName(user);
  const email = user?.primaryEmailAddress?.emailAddress || "";
  return <AccountMenuContent close={close} name={name} email={email} imageUrl={user?.imageUrl} openProfile={() => { close(); openUserProfile(); }} logout={() => signOut({ redirectUrl: "/sign-in" })} />;
}

function FallbackAccountTrigger({ onClick, rail }: { onClick: () => void; rail: boolean }) {
  useDashboardMessages();
  return (
    <button type="button" onClick={onClick} aria-label={dashboardText("Compte")} className={rail ? "flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-none text-[10px] leading-3 text-[#4b545c] hover:bg-[#f2f4f4]" : "ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#087a46] text-white ring-1 ring-black/5"}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#087a46] text-white ring-1 ring-black/5"><UserRound size={16} aria-hidden="true" /></span>
    </button>
  );
}

function FallbackAccountMenu({ close }: { close: () => void }) {
  useDashboardMessages();
  return <AccountMenuContent close={close} name="Compte local" email="compte@local" logout={() => { window.location.assign("/sign-in"); }} />;
}

function LanguageMenu({close}:{close:()=>void}){
  useDashboardMessages();
  const locale=useDashboardLocale();
  function choose(next:"fr"|"en"){setDashboardLocale(next);close()}
  return <div className="w-[230px] rounded-[8px] border border-[#d1d5d8] bg-white p-1.5 shadow-[0_16px_44px_rgba(15,23,42,.18)]"><p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#7a838b]">{dashboardLabel(locale,"Langue du tableau de bord")}</p>{([['fr','🇫🇷',dashboardText("Français")],['en','🇬🇧',dashboardText("English")]] as const).map(([key,flag,label])=><button key={key} type="button" onClick={()=>choose(key)} className="flex h-10 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[13px] hover:bg-[#f2f4f4]"><span aria-hidden="true">{flag}</span><span className="flex-1">{dashboardText(label)}</span>{locale===key&&<CheckCheck size={15} className="text-[#16855f]"/>}</button>)}</div>
}

function AccountMenuContent({ close, name, email, imageUrl, openProfile, logout }: { close: () => void; name: string; email: string; imageUrl?: string | null; openProfile?: () => void; logout: () => void | Promise<unknown> }) {
  useDashboardMessages();
  const locale = useDashboardLocale();
  const [view, setView] = useState<"home" | "preferences" | "security">("home");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">("light");
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("slaivio.user.preferences") || "{}");
      if (saved.appearance === "light" || saved.appearance === "dark" || saved.appearance === "system") setAppearance(saved.appearance);
      if (typeof saved.inAppNotifications === "boolean") setInAppNotifications(saved.inAppNotifications);
    } catch { /* Ignore invalid personal preferences. */ }
  }, []);

  function navigate(next: typeof view) { setDirection(next === "home" ? "back" : "forward"); setView(next); }
  function applyAppearance(next: "light" | "dark" | "system") {
    setAppearance(next);
    const resolved = next === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next;
    document.documentElement.dataset.theme = resolved;
    window.localStorage.setItem("slaivio.theme", resolved);
  }
  function savePreferences() {
    window.localStorage.setItem("slaivio.user.preferences", JSON.stringify({ appearance, inAppNotifications }));
    close();
  }
  async function signOutAccount() { setSigningOut(true); try { await logout(); } catch { setSigningOut(false); } }

  return <>
    {signingOut && <SlaivioLogoLoader overlay label={locale === "en" ? "Signing out" : dashboardText("Déconnexion")} />}
    <div className="w-[300px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#dfe2e4] bg-white shadow-[0_16px_44px_rgba(15,23,42,.18)]" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div key={view} className={`help-panel-enter-${direction}`}>
        {view === "home" && <>
          <div className="flex items-center gap-3 px-3.5 py-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#087a46] text-[13px] font-semibold text-white"><UserAvatar imageUrl={imageUrl} name={name} size={40} /></div>
            <div className="min-w-0"><p className="truncate text-[13px] font-medium text-[#25292e]">{name}</p><p className="truncate text-[11px] text-[#737a82]">{email}</p></div>
          </div>
          <MenuDivider />
          <button type="button" onClick={() => openProfile?.()} className="flex h-10 w-full items-center gap-2.5 px-3.5 text-left text-[12px] hover:bg-[#f7f8f8]"><UserRound size={14} className="text-[#697179]" />{dashboardText("Mon profil")}<ChevronRight size={14} className="ml-auto text-[#939ba2]" /></button>
          <button type="button" onClick={() => navigate("preferences")} className="flex h-10 w-full items-center gap-2.5 px-3.5 text-left text-[12px] hover:bg-[#f7f8f8]"><SlidersHorizontal size={14} className="text-[#697179]" />{dashboardText("Préférences")}<ChevronRight size={14} className="ml-auto text-[#939ba2]" /></button>
          <button type="button" onClick={() => navigate("security")} className="flex h-10 w-full items-center gap-2.5 px-3.5 text-left text-[12px] hover:bg-[#f7f8f8]"><ShieldCheck size={14} className="text-[#697179]" />{dashboardText("Sécurité")}<ChevronRight size={14} className="ml-auto text-[#939ba2]" /></button>
          <PlatformAdminEntry close={close}/>
          <button type="button" onClick={() => void signOutAccount()} disabled={signingOut} className="flex h-10 w-full items-center gap-2.5 px-3.5 text-left text-[12px] text-[#c73535] hover:bg-[#fff7f7] disabled:opacity-60"><LogOut size={14} />{locale === "en" ? dashboardText("Sign out") : dashboardText("Se déconnecter")}</button>
        </>}
        {view === "preferences" && <>
          <div className="flex h-11 items-center gap-2 border-b border-[#e7eaec] px-2.5"><button type="button" aria-label={dashboardText("Retour")} onClick={() => navigate("home")} className="grid h-7 w-7 place-items-center rounded hover:bg-[#f3f5f4]"><ArrowLeft size={15} /></button><span className="text-[12px] font-semibold">{dashboardText("Préférences")}</span></div>
          <div className="grid gap-3 px-3 py-3.5">
            <label className="grid gap-1 text-[10px] text-[#697179]">{dashboardText("Langue de l’interface")}<select value={locale} onChange={event => setDashboardLocale(event.target.value as "fr" | "en")} className="h-8 rounded-full border border-[#d8dddf] bg-white px-2.5 text-[11px] text-[#25292e]"><option value="fr">{dashboardText("Français")}</option><option value="en">{dashboardText("English")}</option></select></label>
            <fieldset className="grid gap-1"><legend className="mb-0.5 text-[10px] text-[#697179]">{dashboardText("Apparence")}</legend>{([["light", dashboardText("Clair")], ["dark", dashboardText("Sombre")], ["system", dashboardText("Automatique (système)")]] as const).map(([value, label]) => <label key={value} className="flex h-6 items-center gap-2 text-[11px]"><input type="radio" name="account-appearance" checked={appearance === value} onChange={() => applyAppearance(value)} className="accent-[#111]" />{dashboardText(label)}</label>)}</fieldset>
            <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={inAppNotifications} onChange={event => setInAppNotifications(event.target.checked)} className="accent-[#111]" />{dashboardText("Notifications dans l’application")}</label>
            <button type="button" onClick={savePreferences} className="h-8 rounded-full bg-[#111] text-[11px] font-semibold text-white hover:bg-[#303030]">{dashboardText("Enregistrer")}</button>
          </div>
        </>}
        {view === "security" && <>
          <div className="flex h-11 items-center gap-2 border-b border-[#e7eaec] px-2.5"><button type="button" aria-label={dashboardText("Retour")} onClick={() => navigate("home")} className="grid h-7 w-7 place-items-center rounded hover:bg-[#f3f5f4]"><ArrowLeft size={15} /></button><span className="text-[12px] font-semibold">{dashboardText("Sécurité")}</span></div>
          <div className="grid gap-2.5 px-3 py-3.5"><p className="text-[10px] leading-4 text-[#697179]">{dashboardText("Sécurisez l’accès à votre compte personnel.")}</p>{openProfile ? <><p className="text-[10px] text-[#697179]">{dashboardText("La gestion du mot de passe et des sessions est assurée par votre fournisseur de connexion.")}</p><button type="button" onClick={openProfile} className="h-8 rounded-full border border-[#d8dddf] text-[11px] hover:bg-[#f7f8f8]">{dashboardText("Gérer la sécurité du compte")}</button></> : <p className="rounded-md bg-[#f7f8f8] p-2.5 text-[10px] leading-4 text-[#697179]">{dashboardText("La gestion de la sécurité n’est pas disponible pour ce type de session.")}</p>}</div>
        </>}
      </div>
    </div>
  </>;
}

function UserAvatar({ imageUrl, name, size }: { imageUrl?: string | null; name: string; size: number }) {
  useDashboardMessages();
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return <Image src={imageUrl} width={size} height={size} alt={dashboardText("")} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  const initial = name.trim().slice(0, 1).toUpperCase();
  return initial ? <span aria-hidden="true">{initial}</span> : <UserRound size={Math.round(size * 0.5)} aria-hidden="true" />;
}

type HelpArticle = { id: string; title: string; summary: string; content: string; category: string };
const popularHelpArticles: HelpArticle[] = [
  { id: "register-parcel", title: "Comment enregistrer un colis ?", summary: "Réception, client, référence et suivi.", category: "Colis", content: "Ouvrez le module Colis et choisissez Nouveau colis. Sélectionnez le client, renseignez la référence et les informations demandées, puis enregistrez. À la réception physique, confirmez le statut de réception pour démarrer le suivi opérationnel." },
  { id: "create-shipment", title: "Comment créer une expédition ?", summary: "Préparer un départ et y ajouter des colis.", category: "Expéditions", content: "Ouvrez Expéditions et démarrez une nouvelle expédition. Choisissez la route, le service et les informations de départ, puis ajoutez les colis concernés. Vérifiez les éléments avant d’enregistrer ; confirmez le départ seulement lorsqu’il a réellement eu lieu." },
  { id: "register-payment", title: "Comment enregistrer un paiement ?", summary: "Paiements partiels et soldes clients.", category: "Finance", content: "Ouvrez Finance, retrouvez le client ou la facture concernée et choisissez l’action d’enregistrement d’un paiement. Saisissez le montant réellement reçu, le moyen de paiement et sa référence. Un paiement partiel laisse le solde restant à recouvrer." },
  { id: "add-office", title: "Comment ajouter un bureau ?", summary: "Bureaux, entrepôts et accès.", category: "Organisation", content: "Ouvrez le sélecteur d’espace dans la barre latérale. En bas du menu, choisissez Créer un bureau ou Créer un entrepôt. Complétez le nom, le code et les informations de localisation, puis validez la création." },
  { id: "use-whatsapp", title: "Comment utiliser WhatsApp ?", summary: "Connexion, conversations et réponses.", category: "Communication", content: "Ouvrez le module de communication WhatsApp et vérifiez que le compte professionnel de l’agence est connecté. Les messages sortants doivent respecter les modèles approuvés et les règles de consentement. Les conversations entrantes sont traitées depuis la boîte de réception." },
];

function HelpMenu({ close }: { close: () => void }) {
  useDashboardMessages();
  const [view, setView] = useState<"home" | "article" | "contact" | "shortcuts">("home");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [search, setSearch] = useState("");
  const [publishedArticles, setPublishedArticles] = useState<HelpArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [articlesError, setArticlesError] = useState("");
  const [sending, setSending] = useState(false);
  const [ticketReference, setTicketReference] = useState("");
  const [contactError, setContactError] = useState("");

  useEffect(() => {
    let active = true;
    listArticles().then(items => {
      if (active) setPublishedArticles(items.map(item => ({ id: item.id, title: item.title, summary: item.summary || "", content: item.content, category: item.category })));
    }).catch(() => {
      if (active) setArticlesError("Les articles du centre d’aide ne sont pas disponibles pour le moment.");
    }).finally(() => { if (active) setArticlesLoading(false); });
    return () => { active = false; };
  }, []);

  function navigate(next: typeof view) {
    setDirection(next === "home" ? "back" : "forward");
    setView(next);
  }
  const allArticles = [...popularHelpArticles, ...publishedArticles];
  const query = search.trim().toLocaleLowerCase("fr");
  const matchingArticles = allArticles.filter(item => `${item.title} ${item.summary} ${item.content} ${item.category}`.toLocaleLowerCase("fr").includes(query));
  const headerTitle = view === "home" ? "Aide & assistance" : view === "article" ? selectedArticle?.title || "Article d’aide" : view === "contact" ? "Contacter le support" : "Raccourcis clavier";

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setContactError("");
    try {
      const ticket = await createTicket({
        subject: String(form.get("subject") || ""),
        description: String(form.get("description") || ""),
        category: String(form.get("category") || "FONCTIONNALITÉ"),
        priority: "NORMAL",
      });
      setTicketReference(ticket.ticket_reference);
    } catch {
      setContactError("Impossible d’envoyer votre demande. Vérifiez vos droits d’accès au support et réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section role="dialog" aria-label={dashboardText("Aide & assistance")} className="w-[344px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[12px] border border-[#dfe2e4] bg-white shadow-[0_16px_44px_rgba(15,23,42,.16)]">
      <header className="flex h-[54px] items-center gap-2.5 border-b border-[#e7eaec] px-3">
        {view !== "home" && <button type="button" onClick={() => { setTicketReference(""); setContactError(""); navigate("home"); }} aria-label={dashboardText("Retour")} className="grid h-8 w-8 place-items-center rounded-md text-[#596169] hover:bg-[#f3f5f4]"><ArrowLeft size={16}/></button>}
        <span className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#e0e3e5] text-[#30363a]"><CircleHelp size={16}/></span>
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#25292e]">{headerTitle}</h2>
        <button type="button" onClick={close} aria-label={dashboardText("Fermer l’aide")} className="grid h-8 w-8 place-items-center rounded-md text-[#697179] hover:bg-[#f3f5f4]"><X size={15}/></button>
      </header>
      <div key={view + (selectedArticle?.id || "")} className={`help-panel-enter-${direction} max-h-[min(590px,calc(100vh-130px))] overflow-y-auto`}>
        {view === "home" && <div className="px-3 pb-2 pt-4">
          <h3 className="text-[15px] font-semibold text-[#25292e]">{dashboardText("Comment pouvons-nous vous aider ?")}</h3>
          <p className="mt-1 text-[12px] text-[#697179]">{dashboardText("Trouvez rapidement une réponse.")}</p>
          <label className="relative mt-3 block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858d93]"/>
            <input aria-label={dashboardText("Rechercher dans l’aide")} value={search} onChange={event => setSearch(event.target.value)} placeholder={dashboardText("Rechercher dans l’aide...")} className="h-9 w-full rounded-full border border-[#d8dddf] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#16855f]"/>
          </label>
          <p className="mb-1 mt-3 text-[11px] text-[#697179]">{query ? dashboardText("Résultats") : dashboardText("Articles populaires")}</p>
          <div className="divide-y divide-[#f0f1f2]">
            {(query ? matchingArticles : popularHelpArticles).slice(0, 8).map(article => <button key={article.id} type="button" onClick={() => { setSelectedArticle(article); navigate("article"); }} className="flex min-h-[48px] w-full items-center gap-2 px-1 py-2 text-left hover:bg-[#fafbfb]">
              <BookOpen size={13} className="shrink-0 text-[#737b82]"/>
              <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[#25292e]">{dashboardText(article.title)}</span><span className="mt-0.5 block truncate text-[10px] text-[#737b82]">{article.summary}</span></span>
              <ChevronRight size={14} className="shrink-0 text-[#939ba2]"/>
            </button>)}
            {query && !matchingArticles.length && !articlesLoading && <p className="px-2 py-4 text-[12px] text-[#697179]">{dashboardText("Aucun article trouvé. Vous pouvez contacter le support Slaivio.")}</p>}
            {query && articlesLoading && <p className="px-2 py-3 text-[11px] text-[#697179]">{dashboardText("Recherche des articles publiés…")}</p>}
            {articlesError && <p className="px-2 py-2 text-[10px] text-amber-700">{articlesError}</p>}
          </div>
          <div className="mt-2 border-t border-[#e7eaec] pt-2">
            <button type="button" onClick={() => { setTicketReference(""); setContactError(""); navigate("contact"); }} className="flex min-h-[46px] w-full items-center gap-2 px-1 text-left hover:bg-[#fafbfb]"><MessageSquareText size={14} className="text-[#697179]"/><span className="min-w-0 flex-1"><span className="block text-[12px] font-medium text-[#25292e]">{dashboardText("Contacter le support")}</span><span className="block text-[10px] text-[#737b82]">{dashboardText("Envoyer une demande à l’équipe Slaivio")}</span></span><ChevronRight size={14} className="text-[#939ba2]"/></button>
            <button type="button" onClick={() => navigate("shortcuts")} className="flex min-h-[42px] w-full items-center gap-2 px-1 text-left hover:bg-[#fafbfb]"><Keyboard size={14} className="text-[#697179]"/><span className="min-w-0 flex-1 text-[12px] font-medium text-[#25292e]">{dashboardText("Raccourcis clavier")}</span><ChevronRight size={14} className="text-[#939ba2]"/></button>
          </div>
        </div>}
        {view === "article" && selectedArticle && <article className="px-4 py-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#16855f]">{selectedArticle.category}</p>
          <h3 className="mt-1 text-[15px] font-semibold leading-5 text-[#25292e]">{dashboardText(selectedArticle.title)}</h3>
          <p className="mt-1 text-[12px] text-[#697179]">{selectedArticle.summary}</p>
          <div className="mt-4 whitespace-pre-wrap text-[13px] leading-6 text-[#424a50]">{selectedArticle.content}</div>
          <div className="mt-4 border-t border-[#e7eaec] pt-3 text-[11px] text-[#697179]">{dashboardText("Cet article vous a-t-il aidé ? ")}<button type="button" onClick={() => navigate("home")} className="ml-2 font-medium text-[#16855f] hover:underline">{dashboardText("Oui, merci")}</button></div>
        </article>}
        {view === "contact" && <div className="px-4 py-4">
          {ticketReference ? <div className="py-5 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><TicketCheck size={20}/></span><h3 className="mt-3 text-[14px] font-semibold text-[#25292e]">{dashboardText("Demande envoyée au support Slaivio")}</h3><p className="mt-1 text-[12px] text-[#697179]">{dashboardText("Référence : ")}{ticketReference}</p><button type="button" onClick={close} className="mt-4 h-9 rounded-[6px] bg-[#272a2f] px-4 text-[12px] font-semibold text-white">{dashboardText("Fermer")}</button></div> : <form onSubmit={submitContact} className="grid gap-3">
            <p className="text-[12px] text-[#697179]">{dashboardText("Décrivez votre demande. Elle sera transmise à l’équipe support de Slaivio.")}</p>
            <label className="grid gap-1 text-[11px] font-medium text-[#59636e]">{dashboardText("Sujet")}<input required minLength={5} name="subject" defaultValue="" placeholder={dashboardText("Ex. Besoin d’aide sur une expédition")} className="h-9 rounded-[6px] border border-[#d8dddf] px-2.5 text-[12px] outline-none focus:border-[#16855f]"/></label>
            <label className="grid gap-1 text-[11px] font-medium text-[#59636e]">{dashboardText("Type de demande")}<select name="category" className="h-9 rounded-[6px] border border-[#d8dddf] bg-white px-2.5 text-[12px]"><option value="FONCTIONNALITÉ">{dashboardText("Utilisation d’une fonctionnalité")}</option><option value="TECHNIQUE">{dashboardText("Problème technique")}</option><option value="COMPTE">{dashboardText("Compte et accès")}</option><option value="FACTURATION">{dashboardText("Abonnement ou facturation")}</option><option value="AUTRE">{dashboardText("Autre demande")}</option></select></label>
            <label className="grid gap-1 text-[11px] font-medium text-[#59636e]">{dashboardText("Description")}<textarea required minLength={10} name="description" rows={4} placeholder={dashboardText("Expliquez ce qui s’est passé et le résultat attendu.")} className="resize-y rounded-[6px] border border-[#d8dddf] p-2.5 text-[12px] outline-none focus:border-[#16855f]"/></label>
            {contactError && <p role="alert" className="text-[11px] text-red-700">{contactError}</p>}
            <button disabled={sending} className="h-9 rounded-[6px] bg-[#272a2f] px-4 text-[12px] font-semibold text-white disabled:opacity-60">{sending ? dashboardText("Envoi…") : dashboardText("Envoyer au support Slaivio")}</button>
          </form>}
        </div>}
        {view === "shortcuts" && <div className="grid gap-2 px-4 py-4">
          <p className="mb-1 text-[12px] text-[#697179]">{dashboardText("Accédez rapidement aux commandes principales.")}</p>
          <div className="flex items-center justify-between border-b border-[#edf0f2] py-2 text-[12px]"><span>{dashboardText("Ouvrir la recherche")}</span><kbd className="rounded border border-[#d8dddf] bg-[#f8f9f9] px-2 py-1 text-[11px]">{dashboardText("Ctrl K")}</kbd></div>
          <div className="flex items-center justify-between border-b border-[#edf0f2] py-2 text-[12px]"><span>{dashboardText("Fermer un menu ou une fenêtre")}</span><kbd className="rounded border border-[#d8dddf] bg-[#f8f9f9] px-2 py-1 text-[11px]">{dashboardText("Esc")}</kbd></div>
          <p className="mt-1 text-[10px] text-[#858d93]">{dashboardText("Sur Mac, utilisez ⌘ à la place de Ctrl.")}</p>
        </div>}
      </div>
    </section>
  );
}



function MenuDivider() {
  useDashboardMessages();
  return <div className="mx-4 my-2 h-px bg-[#eceeef]" />;
}
