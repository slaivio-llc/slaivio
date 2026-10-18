"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Package, Radar, RefreshCw, Truck } from "lucide-react";

import { usePermissions } from "@/components/permissions/permission-provider";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { businessLabel } from "@/components/ui/business-labels";
import { getPackageStats, type PackageStats } from "@/services/packages";
import { getShipmentDepartureCalendar, getShipmentStats, type ExpeditionStats, type ShipmentDepartureCalendarItem } from "@/services/shipments";
import { listTracking, type TrackingItem } from "@/services/tracking";
import { PackagesPage } from "@/components/packages/packages-page";
import { ShipmentsPage } from "@/components/shipments/shipments-page";
import { DepartureCalendarPage } from "@/components/departures/departure-calendar-page";
import { TrackingPage } from "@/components/tracking/tracking-page";

type OperationsView = "overview" | "packages" | "shipments" | "calendar" | "tracking";

type HubData = {
  packages: PackageStats | null;
  shipments: ExpeditionStats | null;
  upcoming: ShipmentDepartureCalendarItem[];
  upcomingTruncated: boolean;
  tracking: TrackingItem[];
  failed: { packages: boolean; shipments: boolean; upcoming: boolean; tracking: boolean };
};

const initialData: HubData = {
  packages: null,
  shipments: null,
  upcoming: [],
  upcomingTruncated: false,
  tracking: [],
  failed: { packages: false, shipments: false, upcoming: false, tracking: false },
};

const dateOnly = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(value));
const routeName = (item: ShipmentDepartureCalendarItem) => item.route_label || `${item.origin_city || item.origin_country || "Origine"} → ${item.destination_city || item.destination_country || "Destination"}`;

export function ParcelOperationsHub() {
  const { permissions, loading: permissionsLoading, available } = usePermissions();
  const canPackages = available && permissions.includes("packages.read");
  const canShipments = available && permissions.includes("shipments.read");
  const canTracking = available && permissions.includes("tracking.read");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<OperationsView>("overview");
  const [visited, setVisited] = useState<Set<OperationsView>>(() => new Set(["overview"]));

  function selectView(next: OperationsView) {
    setView(next);
    setVisited(current => current.has(next) ? current : new Set(current).add(next));
  }

  useEffect(() => {
    if (permissionsLoading) return;
    let active = true;
    setLoading(true);

    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 31);

    Promise.allSettled([
      canPackages ? getPackageStats() : Promise.resolve(null),
      canShipments ? getShipmentStats() : Promise.resolve(null),
      canShipments ? getShipmentDepartureCalendar(start.toISOString(), end.toISOString()) : Promise.resolve(null),
      canTracking ? listTracking({ page: 1, page_size: 30 }) : Promise.resolve(null),
    ]).then(([packagesResult, shipmentsResult, upcomingResult, trackingResult]) => {
      if (!active) return;
      const packages = packagesResult.status === "fulfilled" ? packagesResult.value : null;
      const shipments = shipmentsResult.status === "fulfilled" ? shipmentsResult.value : null;
      const calendar = upcomingResult.status === "fulfilled" ? upcomingResult.value : null;
      const trackingPage = trackingResult.status === "fulfilled" ? trackingResult.value : null;
      const upcoming = (calendar?.items || []).filter(item => !item.departed_at && !["CANCELLED", "DELIVERED", "ARCHIVED"].includes(item.status));
      setData({
        packages,
        shipments,
        upcoming,
        upcomingTruncated: Boolean(calendar?.truncated),
        tracking: (trackingPage?.items || []).filter(item => !["DELIVERED", "CANCELLED", "ARCHIVED"].includes(item.status)).slice(0, 3),
        failed: {
          packages: canPackages && packagesResult.status === "rejected",
          shipments: canShipments && shipmentsResult.status === "rejected",
          upcoming: canShipments && upcomingResult.status === "rejected",
          tracking: canTracking && trackingResult.status === "rejected",
        },
      });
      setLoading(false);
    });

    return () => { active = false; };
  }, [canPackages, canShipments, canTracking, permissionsLoading, revision]);

  return <div className="min-h-full bg-white">
    <OperationPageHeader title="Opérations" description={{ overview: "Vue d’ensemble de l’activité cargo", packages: "Gestion des colis de l’agence", shipments: "Préparation et suivi des expéditions", calendar: "Calendrier des départs planifiés", tracking: "Suivi des opérations en cours" }[view]} actions={<button type="button" onClick={() => setRevision(value => value + 1)} aria-label="Actualiser les opérations" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCw size={15}/></button>}/>
    <main className="mx-auto w-full max-w-[1200px] px-6 pb-10 sm:px-8">
      <nav aria-label="Sections Opérations" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
        <ViewTab active={view === "overview"} onClick={() => selectView("overview")}>Vue d’ensemble</ViewTab>
        {canPackages && <ViewTab active={view === "packages"} onClick={() => selectView("packages")} icon={<Package size={14}/>}>Colis</ViewTab>}
        {canShipments && <ViewTab active={view === "shipments"} onClick={() => selectView("shipments")} icon={<Truck size={14}/>}>Expéditions</ViewTab>}
        {canShipments && <ViewTab active={view === "calendar"} onClick={() => selectView("calendar")} icon={<CalendarDays size={14}/>}>Calendrier</ViewTab>}
        {canTracking && <ViewTab active={view === "tracking"} onClick={() => selectView("tracking")} icon={<Radar size={14}/>}>Tracking</ViewTab>}
      </nav>

      {view === "overview" && <>
      <section aria-label="Indicateurs opérationnels" className="grid gap-2 sm:grid-cols-2">
        <MetricCard onClick={() => selectView("packages")} permission="packages.read" icon={<Package size={15}/>} label="Colis reçus" value={data.packages?.received} loading={loading} error={data.failed.packages} detail="Enregistrés comme reçus"/>
        <MetricCard onClick={() => selectView("shipments")} permission="shipments.read" icon={<Truck size={15}/>} label="Expéditions en cours" value={data.shipments?.active} loading={loading} error={data.failed.shipments} detail="Non clôturées ni annulées"/>
        <MetricCard onClick={() => selectView("calendar")} permission="shipments.read" icon={<CalendarDays size={15}/>} label="Départs à venir" value={data.upcomingTruncated ? "500+" : data.upcoming.length} loading={loading} error={data.failed.upcoming} detail="Sur les 30 prochains jours"/>
        <MetricCard onClick={() => selectView("packages")} permission="packages.read" icon={<Package size={15}/>} label="Colis à livrer" value={data.packages?.ready_for_pickup} loading={loading} error={data.failed.packages} detail="Disponibles pour remise au client"/>
      </section>

      {canShipments && <section className="mt-6" aria-labelledby="upcoming-heading">
        <div className="mb-2 flex items-center justify-between gap-3"><h2 id="upcoming-heading" className="text-sm font-semibold text-slate-900">Prochains départs</h2><button type="button" onClick={() => selectView("calendar")} className="text-xs text-slate-600 hover:text-emerald-800">Voir calendrier →</button></div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {data.failed.upcoming ? <ErrorMessage text="Les prochains départs n’ont pas pu être chargés."/> : loading ? <div role="status" className="p-4 text-xs text-slate-500">Chargement des départs…</div> : !data.upcoming.length ? <p className="p-4 text-xs text-slate-500">Aucun départ planifié dans les 30 prochains jours.</p> : <>
            <div className="grid grid-cols-[88px_minmax(0,1fr)_72px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-medium text-slate-500 sm:grid-cols-[120px_minmax(0,1fr)_90px]"><span>Date</span><span>Route</span><span className="text-right">Colis</span></div>
            {data.upcoming.slice(0, 3).map(item => <Link key={item.id} href={`/app/shipments/${encodeURIComponent(item.id)}`} className="grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-xs hover:bg-slate-50 sm:grid-cols-[120px_minmax(0,1fr)_90px]"><time dateTime={item.calendar_at} className="text-slate-600">{dateOnly(item.calendar_at)}</time><span className="truncate font-medium text-slate-800">{routeName(item)}</span><span className="text-right text-slate-600">{item.packages_count}</span></Link>)}
          </>}
        </div>
      </section>}

      {canTracking && <section className="mt-6" aria-labelledby="tracking-heading">
        <div className="mb-2 flex items-center justify-between gap-3"><h2 id="tracking-heading" className="text-sm font-semibold text-slate-900">Suivi des opérations</h2><button type="button" onClick={() => selectView("tracking")} className="text-xs text-slate-600 hover:text-emerald-800">Voir tracking →</button></div>
        {data.failed.tracking ? <ErrorMessage text="Le suivi opérationnel n’a pas pu être chargé."/> : loading ? <div role="status" className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500">Chargement du suivi…</div> : !data.tracking.length ? <p className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500">Aucune expédition à suivre.</p> : <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
          {data.tracking.map(item => <li key={item.id}><Link href={`/app/tracking/${encodeURIComponent(item.id)}`} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-900">{item.tracking_id}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{item.route_label || `${item.origin_city || item.origin_country || "Origine"} → ${item.destination_city || item.destination_country || "Destination"}`}</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${item.is_delayed ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{item.is_delayed ? "Retard signalé" : businessLabel(item.status)}</span></Link></li>)}
        </ul>}
      </section>}
      </>}
      {visited.has("packages") && <div hidden={view !== "packages"}><PackagesPage embedded /></div>}
      {visited.has("shipments") && <div hidden={view !== "shipments"}><ShipmentsPage embedded /></div>}
      {visited.has("calendar") && <div hidden={view !== "calendar"}><DepartureCalendarPage /></div>}
      {visited.has("tracking") && <div hidden={view !== "tracking"}><TrackingPage /></div>}
    </main>
  </div>;
}

function ViewTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: ReactNode; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${active ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>{icon}{children}</button>;
}

function MetricCard({ onClick, permission, icon, label, value, loading, error, detail }: { onClick: () => void; permission: string; icon: ReactNode; label: string; value?: number | string; loading: boolean; error: boolean; detail: string }) {
  const { permissions, available, loading: permissionsLoading } = usePermissions();
  if (permissionsLoading || !available || !permissions.includes(permission)) return null;
  return <button type="button" onClick={onClick} className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/50">
    <div className="flex items-start justify-between gap-2"><span className="text-[11px] text-slate-600">{label}</span><span className="text-slate-500">{icon}</span></div>
    <strong className="mt-2 block text-xl font-semibold leading-none text-slate-900">{loading ? "—" : error ? "Indisponible" : value ?? "—"}</strong>
    <span className="mt-2 block text-[10px] text-slate-500">{detail}</span>
  </button>;
}

function ErrorMessage({ text }: { text: string }) {
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{text}</p>;
}
