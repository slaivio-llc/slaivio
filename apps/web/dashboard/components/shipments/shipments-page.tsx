"use client";

import axios from "axios";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plane,
  Plus,
  Ship,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/services/api";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationContent, OperationMetrics, OperationSearch, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationActionMenu, OperationField, OperationFilterPopover, OperationMetric, OperationMetricGrid } from "@/components/ui/operation-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { catalog, type Route, type Service } from "@/services/route-catalog";
import {
  createShipment,
  exportShipments,
  getShipmentStats,
  getShipmentAnalytics,
  listShipments,
  notifyShipmentsBulk,
  type ExpeditionMode,
  type ExpeditionPayload,
  type ExpeditionRecord,
  type ExpeditionStats,
  type ShipmentAnalytics,
  type ExpeditionStatus,
  type RiskLevel,
} from "@/services/shipments";

const statusLabels: Record<ExpeditionStatus, string> = {
  DRAFT: "Brouillon",
  PREPARING: "Préparation",
  LOADING: "Chargement",
  READY_FOR_DEPARTURE: "Prêt départ",
  DISPATCHED: "Expédiée",
  IN_TRANSIT: "En transit",
  ARRIVED_DESTINATION: "Arrivée",
  CUSTOMS_CLEARANCE: "Douane",
  AVAILABLE_FOR_PICKUP: "Disponible",
  OUT_FOR_DELIVERY: "Livraison",
  DELIVERED: "Livrée",
  BLOCKED: "Bloquée",
  CANCELLED: "Annulée",
  ARCHIVED: "Archivée",
};

const statusStyles: Record<ExpeditionStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  PREPARING: "bg-amber-50 text-amber-700 ring-amber-100",
  LOADING: "bg-orange-50 text-orange-700 ring-orange-100",
  READY_FOR_DEPARTURE: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  DISPATCHED: "bg-blue-50 text-blue-700 ring-blue-100",
  IN_TRANSIT: "bg-blue-50 text-blue-700 ring-blue-100",
  ARRIVED_DESTINATION: "bg-purple-50 text-purple-700 ring-purple-100",
  CUSTOMS_CLEARANCE: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  AVAILABLE_FOR_PICKUP: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  OUT_FOR_DELIVERY: "bg-teal-50 text-teal-700 ring-teal-100",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  BLOCKED: "bg-red-50 text-red-700 ring-red-100",
  CANCELLED: "bg-gray-100 text-gray-700 ring-gray-200",
  ARCHIVED: "bg-gray-100 text-gray-700 ring-gray-200",
};

const modeLabels: Record<ExpeditionMode, string> = {
  AIR: "Air",
  SEA: "Mer",
  ROAD: "Route",
  EXPRESS: "Express",
  GROUPAGE: "Groupage",
  OTHER: "Autre",
};

const riskLabels: Record<RiskLevel, string> = {
  LOW: "Faible",
  MEDIUM: "Moyen",
  HIGH: "Élevé",
  CRITICAL: "Critique",
};

const emptyStats: ExpeditionStats = {
  active: 0,
  today: 0,
  in_transit: 0,
  arrivals_today: 0,
  delayed: 0,
  delivery_rate: 0,
  total_weight_kg: 0,
  total_volume_cbm: 0,
};

const views: Array<{ key: string; label: string; status?: ExpeditionStatus }> =
  [
    { key: "all", label: "Toutes" },
    { key: "preparing", label: "Préparation", status: "PREPARING" },
    { key: "transit", label: "En transit", status: "IN_TRANSIT" },
    { key: "arrived", label: "Arrivées", status: "ARRIVED_DESTINATION" },
    { key: "customs", label: "Douane", status: "CUSTOMS_CLEARANCE" },
    { key: "delivered", label: "Livrées", status: "DELIVERED" },
    { key: "blocked", label: "Bloquées", status: "BLOCKED" },
  ];

const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#cfd5dd] bg-white px-3 text-[13px] font-medium text-[#1f2328] shadow-sm transition hover:bg-[#f7f8fa]";
const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#12c76f] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#0fb966]";
const pagerButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-md border border-[#cfd5dd] bg-white text-[#334155] shadow-sm disabled:opacity-40";
const formInputClass =
  "h-9 w-full rounded-md border border-[#cfd5dd] bg-white px-3 text-[14px] outline-none focus:border-[#12c76f]";

type Pagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export function ShipmentsPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<ExpeditionRecord[]>([]);
  const [stats, setStats] = useState<ExpeditionStats>(emptyStats);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    page_size: 30,
    total: 0,
    total_pages: 0,
  });
  const [activeView, setActiveView] = useState("all");
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ExpeditionStatus | "">("");
  const [mode, setMode] = useState<ExpeditionMode | "">("");
  const [risk, setRisk] = useState<RiskLevel | "">("");
  const [sort, setSort] = useState("updated_desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<ShipmentAnalytics | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [routeId, setRouteId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const selectedRoute = routes.find(route => route.id === routeId);
  const routeServices = services.filter(service => service.route_id === routeId);
  const selectedService = routeServices.find(service => service.id === serviceId);
  useEffect(() => {
    if (!formOpen) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError("");
    catalog().then(result => {
      if (cancelled) return;
      setRoutes(result.routes.filter(route => route.active));
      setServices(result.services);
      setRouteId("");
      setServiceId("");
    }).catch(() => {
      if (!cancelled) setCatalogError("Impossible de charger les routes et services. Fermez puis rouvrez ce formulaire pour réessayer.");
    }).finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, [formOpen]);

  const currentView = views.find((view) => view.key === activeView) || views[0];
  const page = pagination.page || 1;

  useEffect(() => {
    const timeout = window.setTimeout(() => loadShipments(1), 180);
    return () => window.clearTimeout(timeout);
    // The listed filters intentionally define when the debounced request runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, mode, risk, sort, activeView]);

  useEffect(() => {
    loadStats();
    void getShipmentAnalytics()
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
  }, []);

  const statusParam = currentView.status || status || "";

  async function loadStats() {
    try {
      setStats(await getShipmentStats());
    } catch {
      setStats(emptyStats);
    }
  }

  async function loadShipments(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const response = await listShipments({
        q: query || undefined,
        status: statusParam,
        mode,
        risk_level: risk,
        sort,
        page: nextPage,
        page_size: 30,
      });
      setShipments(response.items);
      setPagination(response.pagination);
    } catch (err) {
      if (!API_BASE_URL) {
        setError(
          "API injoignable. Configurez NEXT_PUBLIC_API_BASE_URL avec l'URL du backend.",
        );
      } else if (axios.isAxiosError(err) && err.response?.status) {
        setError(
          `Erreur API (${err.response.status}). ${String(err.response.data?.detail || "Impossible de charger les expéditions.")}`,
        );
      } else {
        setError(
          "Erreur API réseau. Vérifiez le backend et la configuration CORS.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const form = new FormData(event.currentTarget);
    if (!selectedRoute || !selectedService || catalogLoading || catalogError) {
      setFormError("Sélectionnez une route et son service configuré.");
      setSaving(false);
      return;
    }
    const departure = value(form, "planned_departure_at");
    const arrival = value(form, "eta_at");
    if (departure && arrival && new Date(arrival) < new Date(departure)) {
      setFormError("L’arrivée estimée doit être après le départ prévu.");
      setSaving(false);
      return;
    }
    const payload: ExpeditionPayload = {
      route_id: selectedRoute.id,
      shipping_service_id: selectedService.id,
      title: value(form, "title") || `${selectedRoute.route_name} · ${selectedService.service_name}`,
      status: "PREPARING",
      currency: selectedService.currency_code,
      carrier_name: value(form, "carrier_name"),
      flight_number: value(form, "flight_number"),
      container_number: value(form, "container_number"),
      awb_number: value(form, "awb_number"),
      bl_number: value(form, "bl_number"),
      planned_departure_at: departure ? new Date(departure).toISOString() : undefined,
      eta_at: arrival ? new Date(arrival).toISOString() : undefined,
      notes: value(form, "notes"),
    };
    try {
      const created = await createShipment(clean(payload));
      setFormOpen(false);
      await Promise.all([loadShipments(1), loadStats()]);
      router.push(`/app/shipments/${created.id}`);
    } catch (err) {
      setFormError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.detail || "Création impossible.")
          : "Création impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    const blob = await exportShipments({
      q: query || undefined,
      status: statusParam,
      mode,
      risk_level: risk,
      sort,
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "expeditions.csv";
    link.click();
    URL.revokeObjectURL(href);
  }

  const kpis = useMemo(
    () => [
      { label: "Expéditions actives", value: stats.active, icon: Plane, view: "all" },
      { label: "Aujourd'hui", value: stats.today, icon: CalendarClock, view: "all" },
      { label: "En transit", value: stats.in_transit, icon: Truck, view: "transit" },
      {
        label: "Arrivées aujourd'hui",
        value: stats.arrivals_today,
        icon: Ship, view: "arrived",
      },
      { label: "Retards", value: stats.delayed, icon: AlertCircle, warm: true, view: "blocked" },
      {
        label: "Taux livraison",
        value: `${stats.delivery_rate || 0}%`,
        icon: ArrowRight, view: "delivered",
      },
    ],
    [stats],
  );

  return (
    <div className="min-h-full bg-white text-[#1f2328]">
      <section className="overflow-hidden bg-white">
        <OperationPageHeader
          title="Expéditions"
          description="Pilotez les transports réels de vos colis : routes, ETA, statuts, clients concernés, documents, coûts et risques."
          actions={
            <>
              <PermissionGuard permission="shipments.read">
                <button className={buttonClass} onClick={handleExport}><Download size={14} />Exporter CSV</button>
              </PermissionGuard>
              <PermissionGuard permission="shipments.create">
                <button
                  className={primaryButtonClass}
                  onClick={() => setFormOpen(true)}
                >
                  <Plus size={16} /> Nouvelle expédition
                </button>
              </PermissionGuard>
            </>
          }
        />

        <OperationMetrics>
          <OperationMetricGrid className="lg:grid-cols-6">
            {kpis.map((item) => (
              <OperationMetric key={item.label} label={item.label} value={item.value} tone={activeMetric === item.label ? "success" : item.warm ? "warning" : "default"} active={activeMetric === item.label} onClick={() => { setActiveMetric(item.label); setActiveView(item.view); setStatus(""); }} />
            ))}
          </OperationMetricGrid>
        </OperationMetrics>

        {analyticsOpen ? (
          <>
            <OperationToolbar filters={<OperationActionMenu><button onClick={() => setAnalyticsOpen(false)}>Revenir à la liste</button></OperationActionMenu>} />
            <ShipmentAnalyticsView data={analytics} />
          </>
        ) : (
          <>
            <OperationToolbar
              search={<OperationSearch value={query} onChange={setQuery} placeholder="Rechercher une expédition…" />}
              filters={
                <>
                <OperationFilterPopover
                  open={filtersOpen}
                  onOpenChange={setFiltersOpen}
                  activeCount={[status, mode, risk].filter(Boolean).length + (sort !== "updated_desc" ? 1 : 0) + (activeView !== "all" ? 1 : 0)}
                  onReset={() => { setActiveMetric(null); setActiveView("all"); setStatus(""); setMode(""); setRisk(""); setSort("updated_desc"); }}
                  title="Filtrer les expéditions"
                >
                  <OperationField label="Vue">
                    <select className="h-10 w-full rounded-md border border-[#cfd5dd] bg-white px-3 text-[13px] outline-none" value={activeView} onChange={(event) => { setActiveMetric(null); setActiveView(event.target.value); setStatus(""); }}>
                      {views.map((view) => <option key={view.key} value={view.key}>{view.label}</option>)}
                    </select>
                  </OperationField>
                  <OperationField label="Étape de l’expédition">
                  <select
                    className="h-10 w-full rounded-md border border-[#cfd5dd] bg-white px-3 text-[13px] outline-none focus:border-[#12a865]"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as ExpeditionStatus | "")
                    }
                    disabled={Boolean(currentView.status)}
                  >
                    <option value="">Toutes les étapes</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  </OperationField>
                  <OperationField label="Mode de transport">
                  <select
                    className="h-10 w-full rounded-md border border-[#cfd5dd] bg-white px-3 text-[13px] outline-none focus:border-[#12a865]"
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value as ExpeditionMode | "")
                    }
                  >
                    <option value="">Tous les modes</option>
                    {Object.entries(modeLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  </OperationField>
                  <OperationField label="Niveau de risque">
                  <select
                    className="h-10 w-full rounded-md border border-[#cfd5dd] bg-white px-3 text-[13px] outline-none focus:border-[#12a865]"
                    value={risk}
                    onChange={(event) =>
                      setRisk(event.target.value as RiskLevel | "")
                    }
                  >
                    <option value="">Tous les niveaux</option>
                    {Object.entries(riskLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  </OperationField>
                  <OperationField label="Ordre d’affichage">
                  <select
                    className="h-10 w-full rounded-md border border-[#cfd5dd] bg-white px-3 text-[13px] outline-none focus:border-[#12a865]"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="updated_desc">Mise à jour récente</option>
                    <option value="eta_asc">ETA proche</option>
                    <option value="created_desc">Création récente</option>
                    <option value="reference_asc">Référence A-Z</option>
                  </select>
                  </OperationField>
                </OperationFilterPopover>
                <OperationActionMenu>
                  <button onClick={() => setAnalyticsOpen(true)}>Voir les analytics</button>
                </OperationActionMenu>
                </>
              }
            />

            <OperationContent className="pt-4">

            {error ? <ErrorState title="Expéditions indisponibles" description={error} /> : null}

            {selected.length > 0 && (
              <div className="flex items-center justify-between bg-[#f0efff] px-4 py-2 text-[12px] text-[#5149bd]">
                <span>{selected.length} expédition(s) sélectionnée(s)</span>
                <PermissionGuard permission="shipments.update">
                  <button
                    className={buttonClass}
                    onClick={async () => {
                      const message = window.prompt(
                        "Message à envoyer aux clients concernés",
                      );
                      if (message) {
                        await notifyShipmentsBulk(selected, message);
                        setSelected([]);
                      }
                    }}
                  >
                    Notifier les clients
                  </button>
                </PermissionGuard>
              </div>
            )}
            <div className="min-h-[460px] overflow-x-auto">
              {loading ? (
                <TableSkeleton rows={7} columns={10} label="Chargement des expéditions…" />
              ) : shipments.length === 0 ? (
                <EmptyState title="Aucune expédition trouvée" description="Créez une expédition puis ajoutez les colis prêts à partir. Les indicateurs se recalculeront automatiquement." />
              ) : (
                <table className="w-full min-w-[1180px] border-collapse text-left text-[13px]">
                  <thead className="bg-[#fbfcfd] text-[#5f6b7a]">
                    <tr className="border-b border-[#e6e9ee]">
                      <th className="w-10 px-4">
                        <input
                          type="checkbox"
                          checked={
                            shipments.length > 0 &&
                            shipments.every((item) =>
                              selected.includes(item.id),
                            )
                          }
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? shipments.map((item) => item.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">Expédition</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Mode</th>
                      <th className="px-4 py-3 font-medium">Route</th>
                      <th className="px-4 py-3 font-medium">Clients</th>
                      <th className="px-4 py-3 font-medium">Colis</th>
                      <th className="px-4 py-3 font-medium">Poids</th>
                      <th className="px-4 py-3 font-medium">Volume</th>
                      <th className="px-4 py-3 font-medium">ETA</th>
                      <th className="px-4 py-3 font-medium">Responsable</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((shipment) => (
                      <tr
                        className="cursor-pointer border-b border-[#edf0f3] hover:bg-[#f7faf9]"
                        key={shipment.id}
                        onClick={() =>
                          router.push(`/app/shipments/${shipment.id}`)
                        }
                      >
                        <td
                          className="px-4"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(shipment.id)}
                            onChange={() =>
                              setSelected(
                                selected.includes(shipment.id)
                                  ? selected.filter((id) => id !== shipment.id)
                                  : [...selected, shipment.id],
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#1f2328]">
                            {shipment.expedition_reference}
                          </div>
                          <div className="text-[#64748b]">
                            {shipment.title ||
                              shipment.batch_reference ||
                              "Expédition cargo"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusStyles[shipment.status]}>
                            {statusLabels[shipment.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {modeLabels[shipment.mode]}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {shipment.route_label ||
                              `${shipment.origin_country || "-"} → ${shipment.destination_country || "-"}`}
                          </div>
                          <div className="text-[#64748b]">
                            {shipment.origin_city || "-"} →{" "}
                            {shipment.destination_city || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3">{shipment.clients_count}</td>
                        <td className="px-4 py-3">{shipment.packages_count}</td>
                        <td className="px-4 py-3">
                          {formatNumber(shipment.total_weight_kg)} kg
                        </td>
                        <td className="px-4 py-3">
                          {formatNumber(shipment.total_volume_cbm)} CBM
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(shipment.eta_at)}
                        </td>
                        <td className="px-4 py-3">
                          {shipment.owner_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight size={16} className="ml-auto text-[#66717e]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between px-1 py-3 text-[13px] text-[#5f6b7a]">
              <span>
                {pagination.total
                  ? `${(page - 1) * pagination.page_size + 1} – ${Math.min(page * pagination.page_size, pagination.total)} sur ${pagination.total} expéditions`
                  : "0 expédition"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className={pagerButtonClass}
                  disabled={page <= 1}
                  onClick={() => loadShipments(page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="rounded-md bg-[#12c76f] px-3 py-1.5 font-semibold text-white">
                  {page}
                </span>
                <button
                  className={pagerButtonClass}
                  disabled={
                    !pagination.total_pages || page >= pagination.total_pages
                  }
                  onClick={() => loadShipments(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            </OperationContent>
          </>
        )}
      </section>

      {formOpen ? (
        <OperationDrawer
          open
          title="Nouvelle expédition"
          description="Choisissez une route et un service, puis ajoutez les colis prêts à partir après la création."
          close={() => setFormOpen(false)}
          width="max-w-2xl"
        >
          <form
            onSubmit={handleCreate}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-[13px] font-medium text-[#334155]">Route
                <select required className={formInputClass} value={routeId} disabled={catalogLoading || !!catalogError} onChange={event => {setRouteId(event.target.value);setServiceId("");}}>
                  <option value="">{catalogLoading ? "Chargement…" : "Choisir une route"}</option>
                  {routes.map(route => <option key={route.id} value={route.id}>{route.route_name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-medium text-[#334155]">Service et voie
                <select required className={formInputClass} value={serviceId} disabled={!routeId || catalogLoading} onChange={event => setServiceId(event.target.value)}>
                  <option value="">Choisir un service</option>
                  {routeServices.map(service => <option key={service.id} value={service.id}>{service.service_name}</option>)}
                </select>
              </label>
              {catalogError && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{catalogError}</p>}
              {!catalogLoading && !catalogError && (!routes.length || (routeId && !routeServices.length)) && <p className="sm:col-span-2 text-sm text-[#69747d]">Configurez une route active et son service dans Routes et Services avant de créer l’expédition.</p>}
              {selectedRoute && <div className="sm:col-span-2 rounded-lg bg-[#f5f8f7] p-3 text-[13px] text-[#52616a]">
                <p>{[selectedRoute.origin_city, selectedRoute.origin_country].filter(Boolean).join(", ")} → {[selectedRoute.destination_city, selectedRoute.destination_country].filter(Boolean).join(", ")}</p>
                {selectedService && <p className="mt-1">{selectedService.service_name} · {selectedService.currency_code} · Délai indicatif : {selectedService.eta_min_days}–{selectedService.eta_max_days} jours</p>}
              </div>}
              <Field name="planned_departure_at" label="Départ prévu" type="datetime-local"/>
              <Field name="eta_at" label="Arrivée estimée" type="datetime-local"/>
              <Field name="title" label="Libellé (optionnel)" placeholder="Généré à partir de la route et du service"/>
              <Field name="carrier_name" label="Transporteur (optionnel)"/>
              {selectedService && ["AIR", "EXPRESS"].includes(selectedService.shipping_mode) && <>
                <Field name="flight_number" label="Numéro de vol (optionnel)"/>
                <Field name="awb_number" label="Lettre de transport aérien · AWB (optionnel)"/>
              </>}
              {selectedService?.shipping_mode === "SEA" && <>
                <Field name="container_number" label="Numéro de conteneur (optionnel)"/>
                <Field name="bl_number" label="Connaissement · BL (optionnel)"/>
              </>}
              <label className="sm:col-span-2 grid gap-1 text-[13px] font-medium text-[#334155]">Notes internes (optionnelles)
                <textarea name="notes" className="min-h-20 w-full rounded-md border border-[#cfd5dd] px-3 py-2 text-[13px]" placeholder="Consignes pour l’équipe"/>
              </label>
            </div>
            {formError ? (
              <div className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {formError}
              </div>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-[#d8dce2] pt-4">
              <button
                type="button"
                className={buttonClass}
                onClick={() => setFormOpen(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={primaryButtonClass}
                disabled={saving || catalogLoading || !!catalogError || !selectedService}
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}{" "}
                Créer l&apos;expédition
              </button>
            </div>
          </form>
        </OperationDrawer>
      ) : null}
    </div>
  );
}

function ShipmentAnalyticsView({ data }: { data: ShipmentAnalytics | null }) {
  if (!data)
    return (
      <div className="flex min-h-[420px] items-center justify-center text-[13px] text-[#687584]">
        Analytics indisponibles.
      </div>
    );
  const delivered = data.summary.delivered || 0;
  const etaRate = Math.round((data.summary.on_time / delivered) * 100) || 0;
  const groups: [
    [string, string | number],
    ...Array<[string, string | number]>,
  ] = [
    ["Respect des ETA", `${etaRate}%`],
    [
      "Transit moyen",
      data.summary.average_transit_hours == null
        ? "—"
        : `${data.summary.average_transit_hours} h`,
    ],
    ["Poids transporté", `${formatNumber(data.summary.total_weight_kg)} kg`],
    ["Volume", `${formatNumber(data.summary.total_volume_cbm)} CBM`],
  ];
  return (
    <div className="space-y-4 bg-[#f7f7f6] p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {groups.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]"
          >
            <p className="text-[12px] text-[#687584]">{label}</p>
            <p className="mt-2 text-[25px] font-medium">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsRows title="Par statut" rows={data.by_status} />
        <AnalyticsRows title="Par mode" rows={data.by_mode} />
        <AnalyticsRows title="Routes principales" rows={data.by_route} />
        <AnalyticsRows title="Retards par route" rows={data.delays_by_route} />
        <AnalyticsRows
          title="Livraisons mensuelles"
          rows={data.monthly_deliveries}
        />
      </div>
    </div>
  );
}
function AnalyticsRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <h3 className="mb-2 text-[14px] font-semibold">{title}</h3>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex justify-between border-b border-[#f0f1f3] py-2 text-[12px]"
        >
          <span>{row.label}</span>
          <b>{row.count}</b>
        </div>
      ))}
      {!rows.length && (
        <p className="py-4 text-[12px] text-[#687584]">Aucune donnée.</p>
      )}
    </section>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-[13px] font-medium text-[#334155]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-[#cfd5dd] px-3 text-[14px] outline-none focus:border-[#12c76f]"
      />
    </label>
  );
}

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[12px] font-medium ring-1 ${className}`}
    >
      {children}
    </span>
  );
}

function value(form: FormData, key: string) {
  const raw = String(form.get(key) || "").trim();
  return raw || undefined;
}

function clean<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as T;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );
}
