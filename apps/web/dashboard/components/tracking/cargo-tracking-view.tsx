"use client";

import { useEffect, useState } from "react";
import { MapPin, Radar, Search } from "lucide-react";
import { businessLabel } from "@/components/ui/business-labels";
import { getTrackingStats, listTracking, type TrackingItem, type TrackingStats } from "@/services/tracking";

type Phase = "all" | "transit" | "delayed" | "arrived";
const emptyStats: TrackingStats = { packages_in_transit: 0, active_shipments: 0, in_transit_shipments: 0, arrived_shipments: 0, delivered_today: 0, delays: 0, incidents_open: 0, average_transit_hours: null };
const date = (value: string | null, empty: string) => value ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : empty;
const route = (item: TrackingItem) => item.route_label || `${item.origin_city || item.origin_country || "Origine non renseignée"} → ${item.destination_city || item.destination_country || "Destination non renseignée"}`;

export function CargoTrackingView({ revision, open, embedded = false }: { revision: number; open: (id: string) => void; embedded?: boolean }) {
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [stats, setStats] = useState<TrackingStats>(emptyStats);
  const [phase, setPhase] = useState<Phase>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const [list, summary] = await Promise.all([
          listTracking({ q: query || undefined, phase: phase === "all" ? undefined : phase, page, page_size: 30 }),
          getTrackingStats(),
        ]);
        if (!active) return;
        setItems(list.items);
        setPage(list.pagination.page);
        setPages(list.pagination.total_pages);
        setTotal(list.pagination.total);
        setStats(summary);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, phase, page, retry, revision]);

  const tabs: { key: Phase; label: string; count?: number }[] = [
    { key: "all", label: "Toutes" },
    { key: "transit", label: "En transit", count: stats.in_transit_shipments },
    { key: "delayed", label: "Retards", count: stats.delays },
    { key: "arrived", label: "Arrivées", count: stats.arrived_shipments },
  ];

  return <section aria-label="Tracking des expéditions" className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
    {!embedded && <header className="px-5 pt-5 sm:px-7">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-900">Tracking</h2><p className="mt-0.5 text-sm text-slate-500">Suivi des expéditions et des colis</p></div>
        <Radar size={17} aria-hidden="true" className="mt-1 text-slate-500" />
      </div>
    </header>}

    <div className="grid grid-cols-3 gap-3 px-5 py-5 sm:px-7">
      <Metric label="En transit" value={stats.in_transit_shipments} tone="default" loading={loading} />
      <Metric label="En retard" value={stats.delays} tone="danger" loading={loading} />
      <Metric label="Arrivées" value={stats.arrived_shipments} tone="success" loading={loading} />
    </div>

    <div className="px-5 sm:px-7">
      <label className="relative block"><Search size={16} aria-hidden="true" className="absolute left-4 top-3 text-slate-400" /><input type="search" maxLength={120} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher une expédition ou une route..." aria-label="Rechercher une expédition ou une route" className="h-10 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
      <nav className="mt-3 flex flex-wrap items-center gap-1" aria-label="Filtrer le tracking">
        {tabs.map(tab => <button key={tab.key} type="button" aria-pressed={phase === tab.key} onClick={() => { setPhase(tab.key); setPage(1); }} className={`rounded-full px-3 py-1.5 text-sm transition ${phase === tab.key ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}>{tab.label}{tab.count != null && <span className="ml-1.5 text-xs text-slate-400">{tab.count}</span>}</button>)}
      </nav>
    </div>

    {error ? <div role="alert" className="p-10 text-center text-sm text-slate-600">Le suivi n’a pas pu être chargé. <button type="button" onClick={() => setRetry(value => value + 1)} className="font-medium underline">Réessayer</button></div>
      : loading ? <div role="status" className="space-y-4 px-5 py-6 sm:px-7">{[0, 1, 2, 3].map(row => <div key={row} className="h-14 animate-pulse rounded-md bg-slate-100" />)}</div>
      : !items.length ? <div className="px-6 py-16 text-center"><p className="text-sm font-medium text-slate-800">{query || phase !== "all" ? "Aucun suivi correspondant" : "Aucune expédition à suivre"}</p><p className="mt-1 text-sm text-slate-500">{query || phase !== "all" ? "Modifiez la recherche ou choisissez un autre filtre." : "Les expéditions apparaîtront après leur création."}</p></div>
      : <ul className="mt-1 divide-y divide-slate-100 border-t border-slate-100">
        {items.map(item => <li key={item.id}><button type="button" onClick={() => open(item.id)} className="w-full px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 sm:px-7">
          <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><strong className="text-sm font-medium text-slate-900">{item.tracking_id}</strong><Status item={item} /></span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">{route(item)} · {item.packages_count} colis</span>
          <span className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin size={13} aria-hidden="true" className="shrink-0" /><span className="truncate">{item.last_location ? `${item.last_location} · ${date(item.last_signal_at, "date du signal inconnue")}` : "Localisation non renseignée"}</span></span>
            <span className="shrink-0">{item.eta_at ? `ETA : ${date(item.eta_at, "")}` : "ETA non renseignée"}</span>
          </span>
        </button></li>)}
        <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-slate-500 sm:px-7"><span>{total ? `${(page - 1) * 30 + 1}–${Math.min(page * 30, total)} sur ${total}` : "0 expédition"}</span><span className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">Précédent</button><button type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">Suivant</button></span></li>
      </ul>}
  </section>;
}

function Metric({ label, value, tone, loading }: { label: string; value?: number; tone: "default" | "danger" | "success"; loading: boolean }) {
  return <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-900"}`}>{loading ? "—" : (value ?? 0).toLocaleString("fr-FR")}</p></div>;
}

function Status({ item }: { item: TrackingItem }) {
  const delayed = item.is_overdue || item.is_delayed || item.status === "BLOCKED";
  const arrived = item.status === "ARRIVED_DESTINATION" || item.status === "AVAILABLE_FOR_PICKUP" || item.status === "OUT_FOR_DELIVERY" || item.status === "DELIVERED";
  const transit = item.status === "DISPATCHED" || item.status === "IN_TRANSIT";
  const label = delayed ? "Retard signalé" : transit ? "En transit" : businessLabel(item.status);
  const styles = delayed ? "bg-red-50 text-red-700" : arrived ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${styles}`}>{label}</span>;
}
