"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BadgeDollarSign, Boxes, Building2, Plane, Plus, Route, Ship, Warehouse, Zap } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationTab } from "@/components/ui/operation-controls";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { catalog as getRouteCatalog } from "@/services/route-catalog";
import { pricingDashboard } from "@/services/pricing-engine";
import { getAdmin, getOfficeContext, setOfficeContext, type AdminData, type OfficeContext } from "@/services/organization-admin";

type Section = "organization" | "services" | "pricing" | "team";
const tabs: Array<[Section, string]> = [["organization", "Organisation"], ["services", "Services & Routes"], ["pricing", "Tarification"], ["team", "Équipe & Accès"]];
const button = "inline-flex h-9 items-center gap-2 rounded-full border border-[#d8dddf] bg-white px-3 text-[12px] font-medium text-[#30363a] hover:bg-[#f5f7f6]";
const primary = "inline-flex h-9 items-center gap-2 rounded-full bg-[#111] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]";

export function ParcelManagementHub() {
  const [data, setData] = useState<AdminData | null>(null);
  const [office, setOffice] = useState<OfficeContext | null>(null);
  const [section, setSection] = useState<Section>("organization");
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getRouteCatalog>> | null>(null);
  const [pricing, setPricing] = useState<Awaited<ReturnType<typeof pricingDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [admin, context] = await Promise.all([getAdmin(), getOfficeContext()]);
      setData(admin); setOffice(context);
    } catch { setError("Les informations de gestion de l’agence sont indisponibles."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (section === "services" && !catalog) getRouteCatalog().then(setCatalog).catch(() => setCatalog({routes: [], services: []}));
    if (section === "pricing" && !pricing) pricingDashboard().then((value) => setPricing(value)).catch(() => setPricing({grids: [], alerts: [], stats: {}, settings: {}}));
  }, [section, catalog, pricing]);
  const locations = data?.locations || [];
  const offices = locations.filter((item) => item.location_type === "OFFICE");
  const warehouses = locations.filter((item) => item.location_type === "WAREHOUSE");
  const activeMembers = data?.members.filter((member) => member.status === "ACTIVE") || [];
  async function selectOffice(id: string) {
    try { setOffice(await setOfficeContext(id || null)); } catch { /* Keep the last confirmed active office. */ }
  }
  if (loading) return <LoadingState label="Chargement de la gestion…" />;
  if (error || !data) return <ErrorState title="Gestion indisponible" description={error || "Les informations de l’agence ne sont pas disponibles."} retry={load} />;
  return <div className="min-h-full min-w-0 bg-white">
    <OperationPageHeader title="Gestion" description="Structure, services, tarifs et collaborateurs de votre agence."
      actions={<label className="grid gap-1 text-[11px] text-[#697178]">Bureau actif<select className="h-9 min-w-[160px] rounded-full border border-[#d8dddf] bg-white px-3 text-[12px] text-[#30363a]" value={office?.selected_office_id || ""} onChange={(event) => void selectOffice(event.target.value)}><option value="">Tous les bureaux autorisés</option>{(office?.offices || []).map((item) => <option key={item.location_id} value={item.location_id}>{item.city || item.name}</option>)}</select></label>}
      />
    <main className="mx-auto w-full min-w-0 max-w-[1200px] px-6 pb-10 sm:px-8">
      <nav aria-label="Sections Gestion" className="operation-tabs mb-4 flex flex-nowrap items-center gap-0 overflow-x-auto pb-2">
        {tabs.map(([key, label]) => <OperationTab key={key} active={section === key} onClick={() => setSection(key)}>{label}</OperationTab>)}
      </nav>
      <div className="w-full min-w-0 bg-white">
        <div className="min-w-0 space-y-4 pt-0">
          {section === "organization" && <><div className="flex flex-wrap items-center justify-between gap-3"><Heading title="Organisation" subtitle="Gérez vos implantations et vos entrepôts." /><PermissionGuard permission="locations.manage"><Link href="/app/settings?section=locations" className={primary}><Plus size={14}/>Nouveau bureau</Link></PermissionGuard></div>
            <div className="grid gap-2 sm:grid-cols-3"><Metric label="Bureaux" value={offices.length}/><Metric label="Entrepôts" value={warehouses.length}/><Metric label="Membres" value={activeMembers.length}/></div>
            <LocationGroup title="Bureaux">{offices.map((item) => <LocationRow key={String(item.id)} name={String(item.name || item.city || "Bureau")} detail={[item.city, item.address].filter(Boolean).join(" · ")} icon="office" badge={activeMembers.filter((member) => member.office_access_scope === "ALL_OFFICES" || member.office_ids.includes(String(item.id))).length + " membres"}/>)}</LocationGroup>
            {!offices.length && <Empty label="Aucun bureau n’est configuré."/>}
            <LocationGroup title="Entrepôts" action={<PermissionGuard permission="locations.manage"><Link href="/app/settings?section=locations" className={button}><Plus size={13}/>Ajouter</Link></PermissionGuard>}>{warehouses.map((item) => <LocationRow key={String(item.id)} name={String(item.name || "Entrepôt")} detail={[item.city, item.country].filter(Boolean).join(" · ")} icon="warehouse"/>)}</LocationGroup>
            {!warehouses.length && <Empty label="Aucun entrepôt n’est configuré."/>}</>}
          {section === "services" && <ServicesRoutesSection catalog={catalog} />}
          {section === "pricing" && <><Heading title="Tarification" subtitle="Grilles et règles utilisées pour calculer les prix des prestations."/><div className="grid gap-2 sm:grid-cols-3"><Metric label="Grilles tarifaires" value={pricing?.grids.length ?? "—"}/><Metric label="Grilles actives" value={pricing?.grids.filter((grid) => grid.status === "ACTIVE").length ?? "—"}/><Metric label="Alertes" value={pricing?.alerts.length ?? "—"}/></div>{pricing?.grids.slice(0, 6).map((grid, index) => <div key={String(grid.id || index)} className="flex justify-between gap-3 border border-[#dfe3e4] px-3 py-3"><span className="text-[12px] font-medium">{String(grid.name || "Grille")}</span><span className="text-[11px] text-[#697178]">{String(grid.status || "")}</span></div>)}<Summary href="/app/pricing" permission="pricing.read" icon={<BadgeDollarSign size={17}/>} title="Ouvrir la tarification" detail="Gérer les grilles, les règles et les frais."/></>}
          {section === "team" && <><div className="flex flex-wrap items-center justify-between gap-3"><Heading title="Équipe & Accès" subtitle="Collaborateurs, rôles et accès aux bureaux."/><PermissionGuard permission="organization.manage"><Link href="/app/settings?section=team" className={primary}><Plus size={14}/>Inviter un membre</Link></PermissionGuard></div><div className="grid gap-2 sm:grid-cols-3"><Metric label="Membres" value={data.members.length}/><Metric label="Actifs" value={activeMembers.length}/><Metric label="Invités" value={data.members.filter((member) => member.status === "INVITED").length}/></div>{data.members.map((member) => <div key={member.id} className="flex justify-between gap-3 border border-[#dfe3e4] px-3 py-3"><span><b className="block text-[12px] font-medium">{member.member_display_name || member.member_email || "Membre"}</b><span className="mt-1 block text-[11px] text-[#697178]">{member.role_name || member.role_code}</span></span><span className="bg-[#f1f2f1] px-2 py-1 text-[10px]">{member.status === "ACTIVE" ? "Actif" : member.status}</span></div>)}</>}
          <p className="text-[10px] text-[#8a9297]">Les éléments affichés proviennent des paramètres et des données de votre agence.</p>
        </div>
      </div>
    </main>
  </div>;
}

function ServicesRoutesSection({ catalog }: { catalog: Awaited<ReturnType<typeof getRouteCatalog>> | null }) {
  const [selected, setSelected] = useState<{kind:"service"|"route";id:string}|null>(null);
  const services = catalog?.services || [], routes = catalog?.routes || [];
  const selectedService = selected?.kind === "service" ? services.find((item) => item.id === selected.id) : null;
  const selectedRoute = selected?.kind === "route" ? routes.find((item) => item.id === selected.id) : null;
  const modeLabel = (mode: string) => ({ AIR: "Aérien", SEA: "Maritime", EXPRESS: "Express", ROAD: "Routier" }[mode.toUpperCase()] || mode);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><Heading title="Services & Routes" subtitle="Prestations et corridors de transport."/><PermissionGuard permission="services.manage"><Link href="/app/settings?section=services" className={primary}><Plus size={14}/>Nouveau service</Link></PermissionGuard></div>
    <section><h3 className="mb-2 text-[12px] font-semibold text-[#25292e]">Services</h3>{services.length ? <div className="grid gap-2 sm:grid-cols-2">{services.map((service) => {
      const mode = service.shipping_mode.toUpperCase(), Icon = mode === "AIR" ? Plane : mode === "SEA" ? Ship : mode === "EXPRESS" ? Zap : Boxes;
      return <button key={service.id} type="button" aria-expanded={selected?.kind === "service" && selected.id === service.id} onClick={() => setSelected(selected?.kind === "service" && selected.id === service.id ? null : {kind:"service",id:service.id})} className="border border-[#dfe3e4] p-3 text-left transition-colors hover:bg-[#fafbfb]"><div className="flex items-center justify-between gap-3"><Icon size={15} className="text-[#59636b]"/><span className={"px-2 py-1 text-[10px] " + (service.active ? "bg-[#dcf5e5] text-[#14804a]" : "bg-[#f1f2f1] text-[#697178]")}>{service.active ? "Actif" : "Inactif"}</span></div><p className="mt-2 text-[12px] font-medium text-[#25292e]">{service.service_name}</p><p className="mt-1 text-[11px] text-[#697178]">Délai indicatif : {service.eta_min_days}–{service.eta_max_days} jours</p></button>;
    })}</div> : <Empty label="Aucun service n’est configuré."/>}</section>
    <section><div className="mb-2 flex flex-wrap items-center justify-between gap-3"><h3 className="text-[12px] font-semibold text-[#25292e]">Routes</h3><PermissionGuard permission="routes.manage"><Link href="/app/settings?section=routes" className={button}><Plus size={13}/>Nouvelle route</Link></PermissionGuard></div>{routes.length ? <div className="space-y-2">{routes.map((route) => <button key={route.id} type="button" aria-expanded={selected?.kind === "route" && selected.id === route.id} onClick={() => setSelected(selected?.kind === "route" && selected.id === route.id ? null : {kind:"route",id:route.id})} className="flex w-full items-center justify-between gap-3 border border-[#dfe3e4] px-3 py-3 text-left transition-colors hover:bg-[#fafbfb]"><span className="flex min-w-0 items-center gap-3"><Route size={14} className="shrink-0 text-[#697178]"/><span className="min-w-0"><span className="block truncate text-[12px] font-medium text-[#25292e]">{route.origin_city || route.origin_country} → {route.destination_city || route.destination_country}</span><span className="mt-1 block text-[11px] text-[#697178]">{modeLabel(route.transport_mode)}</span></span></span><span className={"shrink-0 px-2 py-1 text-[10px] " + (route.active ? "bg-[#dcf5e5] text-[#14804a]" : "bg-[#f1f2f1] text-[#697178]")}>{route.active ? "Active" : "Inactive"}</span></button>)}</div> : <Empty label="Aucune route n’est configurée."/>}</section>
    {selectedService && <section className="border border-[#dfe3e4] bg-[#fafbfb] p-3" aria-live="polite"><div className="flex items-center justify-between gap-3"><h3 className="text-[12px] font-semibold text-[#25292e]">{selectedService.service_name}</h3><button type="button" className="text-[11px] text-[#59636b] underline" onClick={() => setSelected(null)}>Fermer</button></div><p className="mt-2 text-[11px] text-[#697178]">Mode : {modeLabel(selectedService.shipping_mode)} · Délai : {selectedService.eta_min_days}–{selectedService.eta_max_days} jours · État : {selectedService.active ? "Actif" : "Inactif"}</p></section>}
    {selectedRoute && <section className="border border-[#dfe3e4] bg-[#fafbfb] p-3" aria-live="polite"><div className="flex items-center justify-between gap-3"><h3 className="text-[12px] font-semibold text-[#25292e]">{selectedRoute.origin_city || selectedRoute.origin_country} → {selectedRoute.destination_city || selectedRoute.destination_country}</h3><button type="button" className="text-[11px] text-[#59636b] underline" onClick={() => setSelected(null)}>Fermer</button></div><p className="mt-2 text-[11px] text-[#697178]">Mode : {modeLabel(selectedRoute.transport_mode)} · Délai : {selectedRoute.eta_min_days}–{selectedRoute.eta_max_days} jours · État : {selectedRoute.active ? "Active" : "Inactive"}</p></section>}
  </div>;
}

function Heading({title,subtitle}:{title:string;subtitle:string}) { return <div><h2 className="text-[14px] font-semibold text-[#25292e]">{title}</h2><p className="mt-1 text-[11px] text-[#697178]">{subtitle}</p></div>; }
function Metric({label,value}:{label:string;value:string|number}) { return <div className="border border-[#dfe3e4] px-3 py-3"><p className="text-[10px] text-[#697178]">{label}</p><p className="mt-1 text-[16px] font-semibold text-[#25292e]">{value}</p></div>; }
function LocationGroup({title,action,children}:{title:string;action?:React.ReactNode;children:React.ReactNode}) { return <section><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-[12px] font-semibold text-[#25292e]">{title}</h3>{action}</div><div className="space-y-2">{children}</div></section>; }
function LocationRow({name,detail,icon,badge}:{name:string;detail:string;icon:"office"|"warehouse";badge?:string}) { const Icon = icon === "office" ? Building2 : Warehouse; return <Link href="/app/settings?section=locations" className="flex min-w-0 items-center justify-between gap-3 border border-[#dfe3e4] px-3 py-3 hover:bg-[#fafbfb]"><span className="flex min-w-0 items-center gap-3"><Icon size={15} className="shrink-0 text-[#697178]"/><span className="min-w-0"><b className="block truncate text-[12px] font-medium text-[#25292e]">{name}</b><span className="mt-1 block truncate text-[11px] text-[#697178]">{detail || "Implantation"}</span></span></span><span className="flex shrink-0 items-center gap-2">{badge && <span className="bg-[#f1f2f1] px-2 py-1 text-[10px] text-[#59636b]">{badge}</span>}<ArrowRight size={14} className="text-[#697178]"/></span></Link>; }
function Summary({href,permission,icon,title,detail}:{href:string;permission:string;icon:React.ReactNode;title:string;detail:string}) { return <PermissionGuard permission={permission}><Link href={href} className="flex items-center justify-between gap-3 border border-[#dfe3e4] p-4 hover:bg-[#fafbfb]"><span className="flex items-center gap-3"><span className="text-[#59636b]">{icon}</span><span><b className="block text-[12px] font-medium text-[#25292e]">{title}</b><span className="mt-1 block text-[11px] text-[#697178]">{detail}</span></span></span><ArrowRight size={14} className="text-[#697178]"/></Link></PermissionGuard>; }
function Empty({label}:{label:string}) { return <p className="border border-dashed border-[#dfe3e4] px-3 py-5 text-center text-[11px] text-[#697178]">{label}</p>; }
