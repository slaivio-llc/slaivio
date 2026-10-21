"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Boxes, ChevronLeft, ChevronRight, History, MapPin, Pencil, Plane, Plus, Route as RouteIcon, Search, ShieldCheck, Truck } from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer, OperationDrawerTabs } from "@/components/ui/operation-drawer";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { FormGeographyFields } from "@/components/ui/geography-fields";
import { getOfficeContext, type OfficeContext } from "@/services/organization-admin";
import {
  catalog,
  createRoute,
  reactivateRoute,
  suspendRoute,
  type Route,
  type Service,
} from "@/services/route-catalog";
import {
  createService as createCatalogService,
  addServiceRoute,
  serviceDetail as getServiceDetail,
  serviceCatalog as getServiceCatalog,
  transitionService,
  type Catalog as ServiceCatalog,
  updateService,
} from "@/services/service-catalog";

type CatalogData = { routes: Route[]; services: Service[] };
type SettingSection = "services" | "routes";
type ServiceDraft = {
  service_name: string;
  shipping_mode: string;
  description: string;
  eta_min_days: number | null;
  eta_max_days: number | null;
  billing_unit: string;
  office_id: string;
  restrictions: string;
  customer_instructions: string;
  service_active: boolean;
  public_visible: boolean;
};
type ServiceRecord = Service & Record<string, any> & {
  routes?: Array<Record<string, any>>;
  pricing?: Array<Record<string, any>>;
  conditions?: Array<Record<string, any>>;
  audit?: Array<Record<string, any>>;
};
type ServiceTab = "details" | "routes" | "conditions" | "history";
type RouteDraft = {
  route_name: string;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  service_id: string;
  origin_warehouse_id: string;
  destination_office_id: string;
  eta_min_days: number | null;
  eta_max_days: number | null;
  frequency: string;
  instructions: string;
  route_active: boolean;
};

const field =
  "h-11 w-full rounded-lg border border-[#d9e1dd] bg-white px-3.5 text-[14px] text-[#26332d] outline-none transition focus:border-[#16855f] focus:ring-2 focus:ring-[#16855f]/10";
const label = "grid gap-2 text-[13px] font-semibold text-[#414d46]";

function errorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return detail || "La modification n’a pas pu être enregistrée.";
}

function statusLabel(status?: string, active?: boolean) {
  if (active === false || ["INACTIVE", "SUSPENDED", "ARCHIVED"].includes(status || "")) {
    return "Inactif";
  }
  return status === "LIMITED" ? "Disponibilité limitée" : "Actif";
}

export function OrganizationTransportSettings({ section }: { section: SettingSection }) {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [officeContext, setOfficeContext] = useState<OfficeContext | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft | null>(null);
  const [detail, setDetail] = useState<ServiceRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<ServiceTab>("details");
  const [routeQuery, setRouteQuery] = useState("");
  const [routePage, setRoutePage] = useState(0);
  const [routeToAdd, setRouteToAdd] = useState("");
  const [editingService, setEditingService] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const detailRequest = useRef(0);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [serviceCatalogData, setServiceCatalogData] = useState<ServiceCatalog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await catalog());
      setError("");
    } catch {
      setError("Le catalogue opérationnel ne peut pas être chargé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getOfficeContext().then(setOfficeContext).catch(() => setOfficeContext(null)); }, []);

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createStep === 2) {
      if (!serviceDraft) return;
      await createServiceRecord(serviceDraft, serviceDraft.service_active ? "ACTIVE" : "INACTIVE");
      return;
    }
    const form = new FormData(event.currentTarget);
    const intent = String((event.nativeEvent as SubmitEvent).submitter && ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value || "continue");
    const minimum = String(form.get("eta_min_days") || ""), maximum = String(form.get("eta_max_days") || "");
    const draft: ServiceDraft = {
      service_name: String(form.get("service_name") || "").trim(),
      shipping_mode: String(form.get("shipping_mode") || "AIR"),
      description: String(form.get("description") || "").trim(),
      eta_min_days: minimum ? Number(minimum) : null,
      eta_max_days: maximum ? Number(maximum) : null,
      billing_unit: String(form.get("billing_unit") || "KG"),
      office_id: String(form.get("office_id") || ""),
      restrictions: String(form.get("restrictions") || "").trim(),
      customer_instructions: String(form.get("customer_instructions") || "").trim(),
      service_active: form.get("service_active") === "on",
      public_visible: form.get("public_visible") === "on",
    };
    if (draft.eta_min_days !== null && draft.eta_max_days !== null && draft.eta_min_days > draft.eta_max_days) {
      setActionError("Le délai minimum doit être inférieur ou égal au délai maximum.");
      return;
    }
    if (intent === "draft") {
      await createServiceRecord(draft, "DRAFT");
      return;
    }
    if (createStep === 1) {
      setServiceDraft(draft);
      setCreateStep(2);
      setActionError("");
      return;
    }
    await createServiceRecord(serviceDraft || draft, draft.service_active ? "ACTIVE" : "INACTIVE");
  }

  async function createServiceRecord(draft: ServiceDraft, status: "DRAFT" | "ACTIVE" | "INACTIVE") {
    setSaving(true);
    setActionError("");
    try {
      await createCatalogService({
        service_name: draft.service_name,
        shipping_mode: draft.shipping_mode,
        description: draft.description || null,
        category: "TRANSPORT",
        service_type: "TRANSPORT",
        eta_min_days: draft.eta_min_days,
        eta_max_days: draft.eta_max_days,
        owner_name: officeContext?.offices.find((office) => office.location_id === draft.office_id)?.name || null,
        public_visible: draft.public_visible,
        public_description: draft.public_visible ? draft.customer_instructions || null : null,
        status,
        metadata: {
          billing_unit: draft.billing_unit,
          responsible_office_id: draft.office_id || null,
          restrictions: draft.restrictions || null,
          customer_instructions: draft.customer_instructions || null,
        },
      });
      setCreateOpen(false);
      setCreateStep(1);
      setServiceDraft(null);
      setNotice(status === "DRAFT"
        ? "Brouillon enregistré. Vous pourrez le reprendre et l’activer après vérification."
        : "Service enregistré. Associez-le à une route pour le proposer lors de la réception d’un colis.");
      await load();
    } catch (exception) {
      setActionError(errorMessage(exception));
    } finally {
      setSaving(false);
    }
  }

  function openCreateService() {
    setActionError("");
    setCreateStep(1);
    setServiceDraft(null);
    setRouteDraft(null);
    setCreateOpen(true);
    if (!isServices) getServiceCatalog().then(setServiceCatalogData).catch(() => setServiceCatalogData(null));
  }

  async function saveRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (createStep === 2) {
      if (routeDraft) await createRouteRecord(routeDraft, routeDraft.route_active ? "ACTIVE" : "INACTIVE");
      return;
    }
    const minimum = String(form.get("eta_min_days") || ""), maximum = String(form.get("eta_max_days") || "");
    const draft: RouteDraft = {
      route_name: String(form.get("route_name") || "").trim(),
      origin_country: String(form.get("origin_country") || "").trim(),
      origin_city: String(form.get("origin_city") || "").trim(),
      destination_country: String(form.get("destination_country") || "").trim(),
      destination_city: String(form.get("destination_city") || "").trim(),
      service_id: String(form.get("service_id") || ""),
      origin_warehouse_id: String(form.get("origin_warehouse_id") || ""),
      destination_office_id: String(form.get("destination_office_id") || ""),
      eta_min_days: minimum ? Number(minimum) : null,
      eta_max_days: maximum ? Number(maximum) : null,
      frequency: String(form.get("frequency") || "PROGRAMMED"),
      instructions: String(form.get("instructions") || "").trim(),
      route_active: form.get("route_active") === "on",
    };
    if (!draft.service_id) { setActionError("Sélectionnez un service de transport actif."); return; }
    if (draft.eta_min_days !== null && draft.eta_max_days !== null && draft.eta_min_days > draft.eta_max_days) { setActionError("Le délai minimum doit être inférieur ou égal au délai maximum."); return; }
    if (String((event.nativeEvent as SubmitEvent).submitter && ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value || "continue") === "draft") {
      await createRouteRecord(draft, "DRAFT"); return;
    }
    setRouteDraft(draft);
    setCreateStep(2);
    setActionError("");
  }

  async function createRouteRecord(draft: RouteDraft, status: "DRAFT" | "ACTIVE" | "INACTIVE") {
    setSaving(true);
    setActionError("");
    try {
      await createRoute({
        route_name: draft.route_name || null,
        origin_country: draft.origin_country,
        origin_city: draft.origin_city,
        destination_country: draft.destination_country,
        destination_city: draft.destination_city,
        service_ids: [draft.service_id],
        origin_warehouse_id: draft.origin_warehouse_id || null,
        destination_office_id: draft.destination_office_id || null,
        eta_min_days: draft.eta_min_days,
        eta_max_days: draft.eta_max_days,
        description: draft.instructions || null,
        status,
        metadata: { departure_frequency: draft.frequency, operating_instructions: draft.instructions || null },
      });
      setCreateOpen(false);
      setCreateStep(1); setRouteDraft(null);
      setNotice(status === "DRAFT" ? "Brouillon de route enregistré. Vous pourrez l’activer après vérification." : status === "INACTIVE" ? "Route enregistrée comme inactive. Elle pourra être activée quand elle sera prête." : "Route enregistrée et associée au service sélectionné.");
      await load();
    } catch (exception) {
      setActionError(errorMessage(exception));
    } finally {
      setSaving(false);
    }
  }

  async function toggleService(service: Service) {
    setActionError("");
    try {
      const next = ["DRAFT", "INACTIVE", "SUSPENDED"].includes(service.status) ? "ACTIVE" : "INACTIVE";
      await transitionService(service.id, next, "Modification depuis les paramètres de l’agence");
      setNotice(next === "ACTIVE" ? "Service réactivé." : "Service désactivé. Son historique est conservé.");
      await load();
      if (detail?.id === service.id) setDetail(await getServiceDetail(service.id) as unknown as ServiceRecord);
    } catch (exception) {
      setActionError(errorMessage(exception));
    }
  }

  async function openService(service: Service) {
    setDetailTab("details"); setRouteQuery(""); setRoutePage(0); setRouteToAdd(""); setEditingService(false);
    const request = ++detailRequest.current;
    setDetailLoading(true); setDetail(null);
    try { const result = await getServiceDetail(service.id) as unknown as ServiceRecord; if (request === detailRequest.current) setDetail(result); }
    catch (exception) { if (request === detailRequest.current) setActionError(errorMessage(exception)); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  }

  async function reloadDetail() {
    if (!detail) return;
    const fresh = await getServiceDetail(detail.id) as unknown as ServiceRecord;
    setDetail(fresh); await load();
  }

  async function saveServiceChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return;
    const form = new FormData(event.currentTarget);
    const min = String(form.get("eta_min_days") || ""), max = String(form.get("eta_max_days") || "");
    if (min && max && Number(min) > Number(max)) { setActionError("Le délai minimum doit être inférieur ou égal au maximum."); return; }
    const metadata = typeof detail.metadata === "object" && detail.metadata ? detail.metadata : {};
    setDetailSaving(true); setActionError("");
    try {
      await updateService(detail.id, {
        service_name: String(form.get("service_name") || "").trim(),
        description: String(form.get("description") || "").trim() || null,
        shipping_mode: String(form.get("shipping_mode") || detail.shipping_mode),
        eta_min_days: min ? Number(min) : null,
        eta_max_days: max ? Number(max) : null,
        owner_name: officeContext?.offices.find(o => o.location_id === String(form.get("office_id")))?.name || null,
        public_visible: form.get("public_visible") === "on",
        public_description: String(form.get("customer_instructions") || "").trim() || null,
        metadata: { ...metadata, billing_unit: String(form.get("billing_unit") || "KG"), responsible_office_id: String(form.get("office_id") || "") || null, restrictions: String(form.get("restrictions") || "").trim() || null, customer_instructions: String(form.get("customer_instructions") || "").trim() || null },
        change_reason: "Modification depuis la fiche service",
      });
      setEditingService(false); setNotice("Service mis à jour et modification enregistrée dans l’historique."); await reloadDetail();
    } catch (exception) { setActionError(errorMessage(exception)); }
    finally { setDetailSaving(false); }
  }

  async function attachRoute() {
    if (!detail || !routeToAdd) return;
    setDetailSaving(true); setActionError("");
    try {
      await addServiceRoute(detail.id, { route_id: routeToAdd, availability: "AVAILABLE", eta_min_days: detail.eta_min_days ?? null, eta_max_days: detail.eta_max_days ?? null, public_visible: detail.public_visible, metadata: {} });
      setRouteToAdd(""); setNotice("Route associée au service."); await reloadDetail();
    } catch (exception) { setActionError(errorMessage(exception)); }
    finally { setDetailSaving(false); }
  }

  async function toggleRoute(route: Route) {
    setActionError("");
    try {
      if (route.active === false || ["INACTIVE", "SUSPENDED", "ARCHIVED"].includes(route.status)) {
        await reactivateRoute(route.id);
        setNotice("Route réactivée.");
      } else {
        await suspendRoute(route.id, {
          reason_code: "AGENCY_CONFIGURATION",
          reason: "Désactivée depuis les paramètres de l’agence",
        });
        setNotice("Route désactivée. Son historique est conservé.");
      }
      await load();
    } catch (exception) {
      setActionError(errorMessage(exception));
    }
  }

  if (loading && !data) return <LoadingState label="Chargement des services et routes…" />;
  if (!data) return <ErrorState title="Catalogue indisponible" description={error} retry={load} />;

  const activeServices = data.services.filter(service =>
    service.active !== false && ["ACTIVE", "LIMITED"].includes(service.status),
  );
  const isServices = section === "services";

  return (
    <div className="grid gap-5">
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}
      {(error || (!createOpen && actionError)) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error || actionError}</div>}
      <section className="overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_2px_12px_rgba(20,35,32,.035)]">
        <div className="flex flex-col justify-between gap-4 border-b border-[#edf1ee] bg-gradient-to-r from-[#f4faf6] to-white p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
              {isServices ? <Boxes size={20} /> : <RouteIcon size={20} />}
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-[#26332d]">{isServices ? "Services de transport" : "Routes commerciales"}</h3>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#68756d]">
                {isServices
                  ? "Définissez les prestations de l’agence. Un service n’est proposé à la réception qu’après son association à une route active."
                  : "Configurez les liaisons commerciales et les services proposés sur chacune. Une route ne représente pas un bureau ni un départ réel."}
              </p>
            </div>
          </div>
          <PermissionGuard permission={isServices ? "services.create" : "routes.manage"}>
            <OperationButton variant="primary" className="h-10 shrink-0 px-4" onClick={openCreateService}>
              <Plus size={16} />{isServices ? "Ajouter un service" : "Ajouter une route"}
            </OperationButton>
          </PermissionGuard>
        </div>
        <div className="grid gap-3 p-4 sm:p-5">
          {isServices
            ? data.services.map(service => (
              <article key={service.id} className="flex flex-col gap-3 rounded-xl border border-[#e8eeea] p-3 transition hover:border-[#c8ddd1] sm:flex-row sm:items-center">
                <button type="button" onClick={() => void openService(service)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#16855f]">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1f6f3] text-[#416b56]"><Truck size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#26332d]">{service.service_name}</h4>
                    <StatusPill label={statusLabel(service.status, service.active)} active={service.active !== false && ["ACTIVE", "LIMITED"].includes(service.status)} />
                  </div>
                  <p className="mt-1 text-[12px] text-[#748078]">{modeLabel(service.shipping_mode)} · {service.route_count || 0} route{service.route_count === 1 ? "" : "s"} associée{service.route_count === 1 ? "" : "s"}</p>
                </div><ArrowRight size={16} className="mr-1 shrink-0 text-[#89948d]" /></button>
                <PermissionGuard permission="services.suspend">
                  <button type="button" onClick={() => void toggleService(service)} className="h-9 shrink-0 rounded-lg border border-[#dbe3de] px-3 text-[12px] font-semibold text-[#48574e] hover:bg-[#f5f8f6]">
                    {service.active === false || ["INACTIVE", "SUSPENDED"].includes(service.status) ? "Réactiver" : "Désactiver"}
                  </button>
                </PermissionGuard>
              </article>
            ))
            : data.routes.map(route => (
              <article key={route.id} className="flex flex-col gap-4 rounded-xl border border-[#e8eeea] p-4 transition hover:border-[#c8ddd1] sm:flex-row sm:items-center">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1f6f3] text-[#416b56]"><MapPin size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#26332d]">{route.route_name}</h4>
                    <StatusPill label={statusLabel(route.status, route.active)} active={route.active !== false && ["ACTIVE", "LIMITED"].includes(route.status)} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-[#748078]">
                    <span>{route.origin_city}, {route.origin_country}</span><ArrowRight size={12} /><span>{route.destination_city}, {route.destination_country}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-[#748078]">{route.service_names?.length ? route.service_names.join(" · ") : "Aucun service associé"}</p>
                </div>
                <PermissionGuard permission="routes.suspend">
                  <button type="button" onClick={() => void toggleRoute(route)} className="h-9 rounded-lg border border-[#dbe3de] px-3 text-[12px] font-semibold text-[#48574e] hover:bg-[#f5f8f6]">
                    {route.active === false || ["INACTIVE", "SUSPENDED", "ARCHIVED"].includes(route.status) ? "Réactiver" : "Désactiver"}
                  </button>
                </PermissionGuard>
              </article>
            ))}
          {isServices && !data.services.length && <EmptyState title="Aucun service configuré" detail="Créez une prestation propre à l’agence, puis associez-la à une ou plusieurs routes." />}
          {!isServices && !data.routes.length && <EmptyState title="Aucune route configurée" detail="Ajoutez une liaison commerciale. L’origine peut être un point de départ sans bureau physique." />}
        </div>
        <div className="flex items-start gap-2 border-t border-[#edf1ee] bg-[#fbfcfb] px-5 py-3.5 text-[12px] leading-5 text-[#748078]">
          <span className="mt-0.5 text-emerald-700">i</span>
          {isServices
            ? "Les tarifs, délais et conditions se règlent dans leurs domaines dédiés. Désactiver un service préserve les opérations historiques."
            : "Les prix sont définis dans Tarification et les départs réels dans Expéditions. Désactiver une route ne supprime aucun historique."}
        </div>
      </section>

      <OperationDrawer
        open={Boolean(detail) || detailLoading}
        close={() => { detailRequest.current += 1; setDetail(null); setDetailLoading(false); setEditingService(false); }}
        title={detail?.service_name || "Fiche service"}
        description={detail ? `${detail.service_code || "Service"} · ${modeLabel(detail.shipping_mode)}` : "Chargement des informations du service…"}
        placement="center"
        width="max-w-[640px]"
        variant="detail"
        panelClassName="max-sm:!fixed max-sm:!inset-0 max-sm:!h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!max-h-none max-sm:!rounded-none"
        bodyClassName="p-5 sm:p-6"
        headerMeta={detail ? <>
          <StatusPill label={statusLabel(detail.status, detail.active)} active={detail.active !== false && ["ACTIVE", "LIMITED"].includes(detail.status)} />
          {detail.public_visible && <StatusPill label="Informations publiées" active />}
          <span className="text-[11px] text-[#748078]">{detail.service_code}</span>
        </> : undefined}
        headerActions={detail ? <Truck size={18} className="text-[#637269]" /> : undefined}
        tabs={detail ? <OperationDrawerTabs items={[
          { key: "details", label: "Détails" },
          { key: "routes", label: "Routes", count: detail.routes?.length || 0 },
          { key: "conditions", label: "Conditions" },
          { key: "history", label: "Historique" },
        ]} value={detailTab} onChange={(value) => { setDetailTab(value as ServiceTab); setEditingService(false); setActionError(""); }} /> : undefined}
        footer={detail ? <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <PermissionGuard permission="services.suspend"><OperationButton onClick={() => void toggleService(detail)}>{detail.active === false || ["INACTIVE", "SUSPENDED"].includes(detail.status) ? "Réactiver" : "Désactiver"}</OperationButton></PermissionGuard>
          <PermissionGuard permission="services.update"><OperationButton variant="primary" onClick={() => { setEditingService(v => !v); setActionError(""); }}><Pencil size={14}/>{editingService ? "Annuler la modification" : "Modifier le service"}</OperationButton></PermissionGuard>
        </div> : undefined}
      >
        {detailLoading && !detail ? <LoadingState label="Chargement de la fiche service…" /> : detail ? <div className="grid gap-5">
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-[#f8faf9] p-3">
            <Metric label="Routes" value={String(detail.routes?.length || 0)} />
            <Metric label="Délai indicatif" value={detail.eta_min_days == null && detail.eta_max_days == null ? "À définir" : `${detail.eta_min_days ?? "…"}–${detail.eta_max_days ?? "…"} j`} />
            <Metric label="Tarification" value={hasActivePricing(detail) ? "Configurée" : "À définir"} />
          </div>
          {editingService ? <form id="edit-service" onSubmit={saveServiceChanges} className="grid gap-4">
            <h3 className="text-[14px] font-semibold text-[#25292e]">Modifier le service</h3>
            <label className={label}>Nom du service<input className={field} name="service_name" required defaultValue={detail.service_name}/></label>
            <label className={label}>Type de transport<select className={field} name="shipping_mode" defaultValue={detail.shipping_mode}><option value="AIR">Aérien</option><option value="SEA">Maritime</option><option value="EXPRESS">Express</option><option value="ROAD">Routier</option><option value="RAIL">Ferroviaire</option><option value="OTHER">Autre</option></select></label>
            <label className={label}>Description<textarea className={`${field} h-auto min-h-[76px] py-2.5`} name="description" defaultValue={detail.description || ""}/></label>
            <div className="grid grid-cols-2 gap-3"><label className={label}>Délai minimum (jours)<input className={field} type="number" min="0" name="eta_min_days" defaultValue={detail.eta_min_days ?? ""}/></label><label className={label}>Délai maximum (jours)<input className={field} type="number" min="0" name="eta_max_days" defaultValue={detail.eta_max_days ?? ""}/></label></div>
            <label className={label}>Unité de facturation<select className={field} name="billing_unit" defaultValue={detail.metadata?.billing_unit || "KG"}><option value="KG">Kilogramme (kg)</option><option value="CBM">Volume (m³)</option><option value="PACKAGE">Colis</option><option value="FLAT">Forfait</option></select></label>
            <label className={label}>Bureau responsable<select className={field} name="office_id" defaultValue={detail.metadata?.responsible_office_id || ""}><option value="">Tous les bureaux autorisés</option>{(officeContext?.offices || []).map(o => <option key={o.location_id} value={o.location_id}>{o.city || o.name}</option>)}</select></label>
            <label className={label}>Restrictions<textarea className={`${field} h-auto min-h-[70px] py-2.5`} name="restrictions" defaultValue={detail.metadata?.restrictions || ""}/></label>
            <label className={label}>Instructions pour les clients<textarea className={`${field} h-auto min-h-[70px] py-2.5`} name="customer_instructions" defaultValue={detail.metadata?.customer_instructions || ""}/></label>
            <ToggleRow name="public_visible" title="Informations visibles et vérifiées pour les clients" detail="Seules les informations publiées peuvent être utilisées dans les réponses automatiques." defaultChecked={detail.public_visible}/>
            <div className="flex justify-end gap-2"><OperationButton type="submit" form="edit-service" variant="primary" disabled={detailSaving}>{detailSaving ? "Enregistrement…" : "Enregistrer les modifications"}</OperationButton></div>
          </form> : <>
            {detailTab === "details" && <ServiceDetailPanel detail={detail} officeName={officeContext?.offices.find(o => o.location_id === detail.metadata?.responsible_office_id)?.city || officeContext?.offices.find(o => o.location_id === detail.metadata?.responsible_office_id)?.name || detail.owner_name || "—"} />}
            {detailTab === "routes" && <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2"><h3 className="text-[14px] font-semibold">Routes associées</h3><PermissionGuard permission="services.routes"><div className="flex gap-2"><select className={`${field} h-9 min-w-0 max-w-[230px]`} aria-label="Choisir une route à associer" value={routeToAdd} onChange={e => setRouteToAdd(e.target.value)}><option value="">Ajouter une route…</option>{data.routes.filter(r => !detail.routes?.some(x => x.route_id === r.id || x.id === r.id)).map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}</select><OperationButton disabled={!routeToAdd || detailSaving} onClick={() => void attachRoute()}><Plus size={14}/>Ajouter</OperationButton></div></PermissionGuard></div>
              <div className="relative"><Search size={15} className="absolute left-3 top-3 text-[#8b9690]"/><input className={`${field} h-10 rounded-full pl-9`} placeholder="Rechercher une route…" value={routeQuery} onChange={e => {setRouteQuery(e.target.value);setRoutePage(0);}}/></div>
              {(() => { const list=(detail.routes||[]).filter(r=>String(r.route_name||"").toLowerCase().includes(routeQuery.toLowerCase())||String(r.route_code||"").toLowerCase().includes(routeQuery.toLowerCase())); const pages=Math.max(1,Math.ceil(list.length/2)); const visible=list.slice(routePage*2,routePage*2+2); return <><div className="grid gap-2">{visible.map((r,i)=><div key={String(r.id||i)} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e9e7] px-3 py-3"><div><p className="text-[13px] font-medium">{String(r.route_name || `${r.origin_city || ""} → ${r.destination_city || ""}`)}</p><p className="mt-1 text-[11px] text-[#748078]">{String(r.route_code || "Route associée")}</p></div><StatusPill label={String(r.availability || r.status || "Active")} active /></div>)}{!visible.length&&<p className="py-8 text-center text-[13px] text-[#758078]">Aucune route associée ne correspond à la recherche.</p>}</div><div className="flex items-center justify-between border-t border-[#edf0ee] pt-3 text-[12px] text-[#748078]"><span>{list.length} route(s)</span><div className="flex items-center gap-2"><button type="button" className="rounded-full border p-1.5 disabled:opacity-40" disabled={routePage===0} onClick={()=>setRoutePage(p=>Math.max(0,p-1))} aria-label="Page précédente"><ChevronLeft size={15}/></button><span>{routePage+1} / {pages}</span><button type="button" className="rounded-full border p-1.5 disabled:opacity-40" disabled={routePage>=pages-1} onClick={()=>setRoutePage(p=>Math.min(pages-1,p+1))} aria-label="Page suivante"><ChevronRight size={15}/></button></div></div></>; })()}
            </div>}
            {detailTab === "conditions" && <ServiceConditionsPanel detail={detail} />}
            {detailTab === "history" && <ServiceHistoryPanel events={detail.audit || []} />}
          </>}
          {actionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{actionError}</p>}
        </div> : null}
      </OperationDrawer>

      <OperationDrawer
        open={createOpen}
        close={() => { if (!saving) setCreateOpen(false); }}
        title={isServices ? createStep === 1 ? "Nouveau service" : "Vérifier le service" : createStep === 1 ? "Nouvelle route" : "Vérifier la route"}
        description={isServices ? "Configurez une prestation proposée par l’agence." : "Configuration d’un corridor Cargo · Données de l’agence"}
        placement="center"
        width="max-w-[760px]"
        variant="form"
        bodyClassName="p-5 sm:p-7"
        footer={<div className="flex flex-wrap justify-end gap-2">
          {isServices ? createStep === 1 ? <>
            <OperationButton type="button" disabled={saving} onClick={() => setCreateOpen(false)}>Annuler</OperationButton>
            <OperationButton form="create-transport-service" type="submit" name="intent" value="draft" disabled={saving}>Enregistrer en brouillon</OperationButton>
            <OperationButton form="create-transport-service" type="submit" name="intent" value="continue" variant="primary" disabled={saving}>Continuer <ArrowRight size={14}/></OperationButton>
          </> : <>
            <OperationButton type="button" disabled={saving} onClick={() => setCreateStep(1)}>Retour</OperationButton>
            <OperationButton type="submit" form="create-transport-service" variant="primary" disabled={saving}>{saving ? "Enregistrement…" : "Créer le service"}</OperationButton>
          </> : createStep === 1 ? <>
            <OperationButton type="button" disabled={saving} onClick={() => setCreateOpen(false)}>Annuler</OperationButton>
            <OperationButton form="create-commercial-route" type="submit" name="intent" value="draft" disabled={saving}>Enregistrer en brouillon</OperationButton>
            <OperationButton form="create-commercial-route" type="submit" name="intent" value="continue" variant="primary" disabled={saving}>Continuer <ArrowRight size={14}/></OperationButton>
          </> : <>
            <OperationButton type="button" disabled={saving} onClick={() => setCreateStep(1)}>Retour</OperationButton>
            <OperationButton type="button" variant="primary" disabled={saving || !routeDraft} onClick={() => routeDraft && void createRouteRecord(routeDraft, routeDraft.route_active ? "ACTIVE" : "INACTIVE")}>{saving ? "Enregistrement…" : "Créer la route"}</OperationButton>
          </>}
        </div>}
      >
        {isServices
          ? <ServiceCreationForm
              onSubmit={saveService}
              step={createStep}
              draft={serviceDraft}
              offices={officeContext?.offices || []}
              selectedOfficeId={officeContext?.selected_office_id || ""}
              actionError={actionError}
            />
          : createStep === 1 ? <RouteCreationForm services={activeServices} catalog={serviceCatalogData} onSubmit={saveRoute} draft={routeDraft} /> : <RouteReview draft={routeDraft} services={activeServices} catalog={serviceCatalogData} />}
        {!isServices && actionError && <p role="alert" className="mx-auto mt-3 max-w-xl rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{actionError}</p>}
      </OperationDrawer>
    </div>
  );
}

function Metric({ label: title, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[11px] text-[#748078]">{title}</p><p className="mt-1 truncate text-[14px] font-semibold text-[#20252b]">{value}</p></div>;
}

function ServiceDetailPanel({ detail, officeName }: { detail: ServiceRecord; officeName: string }) {
  const metadata = detail.metadata && typeof detail.metadata === "object" ? detail.metadata : {};
  const eta = detail.eta_min_days == null && detail.eta_max_days == null ? "À définir" : `${detail.eta_min_days ?? "…"} à ${detail.eta_max_days ?? "…"} jours`;
  const billing = ({ KG: "Kilogramme (kg)", CBM: "Volume (m³)", PACKAGE: "Colis", FLAT: "Forfait" } as Record<string,string>)[metadata.billing_unit] || metadata.billing_unit || "À définir";
  return <div className="grid gap-5">
    <div className="flex items-center gap-3 rounded-lg bg-[#f8faf9] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#303b34]"><Plane size={19}/></div><div className="min-w-0"><p className="text-[13px] font-semibold">{detail.service_name}</p><p className="mt-1 text-[11px] text-[#748078]">{modeLabel(detail.shipping_mode)} · Facturation au {billing.toLowerCase()}</p></div></div>
    <section className="grid gap-3"><div className="flex items-center justify-between"><h3 className="text-[14px] font-semibold">Informations générales</h3></div>{metadata.description && <p className="text-[12px] text-[#748078]">Description</p>}<p className="text-[13px] leading-5 text-[#303b34]">{detail.description || "Aucune description renseignée."}</p><div className="grid gap-2 border-t border-[#edf0ee] pt-3">{[["Type de transport",modeLabel(detail.shipping_mode)],["Délai indicatif",eta],["Unité de facturation",billing],["Bureau responsable",officeName],["Date de création",formatDate(detail.created_at)]].map(([k,v])=><InfoRow key={k} label={k} value={v}/>)}</div></section>
    <section className="grid gap-2 rounded-lg border border-[#e4e9e6] p-3"><div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">Tarification</h3><StatusPill label={hasActivePricing(detail) ? "Configurée" : "À définir"} active={hasActivePricing(detail)}/></div><p className="text-[11px] text-[#748078]">{hasActivePricing(detail) ? "Une tarification est disponible pour ce service." : "Aucun tarif actif n’est renseigné pour le moment."}</p><a className="flex h-9 items-center justify-center rounded-full border border-[#dce2de] text-[12px] font-medium text-[#48574e] hover:bg-[#f6f8f7]" href="/app/pricing">Gérer la tarification ↗</a></section>
  </div>;
}

function ServiceConditionsPanel({ detail }: { detail: ServiceRecord }) {
  const metadata = detail.metadata && typeof detail.metadata === "object" ? detail.metadata : {};
  return <div className="grid gap-5"><h3 className="text-[14px] font-semibold">Conditions du service</h3><section className="grid gap-2"><p className="text-[12px] text-[#748078]">Restrictions et marchandises concernées</p><p className="text-[13px] leading-5">{metadata.restrictions || "Aucune restriction particulière renseignée."}</p></section><section className="grid gap-2 border-t border-[#edf0ee] pt-4"><p className="text-[12px] text-[#748078]">Instructions aux clients</p><p className="text-[13px] leading-5">{metadata.customer_instructions || "Aucune instruction particulière renseignée."}</p></section><section className="grid gap-2 border-t border-[#edf0ee] pt-4"><div className="flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck size={15}/> Utilisation par l’IA</div><p className="text-[11px] leading-5 text-[#748078]">Seules les informations client publiées et vérifiées peuvent être utilisées pour les réponses automatiques. Les changements doivent être vérifiés avant publication.</p><p className="text-[11px] font-medium">{detail.public_visible ? "Informations visibles pour les clients." : "Informations internes, non visibles pour les clients."}</p></section></div>;
}

function ServiceHistoryPanel({ events }: { events: Array<Record<string, any>> }) {
  return <div className="grid gap-2"><h3 className="mb-1 text-[14px] font-semibold">Historique des modifications</h3>{events.map((event,i)=><div key={String(event.id||i)} className="flex gap-3 border-b border-[#edf0ee] py-3"><History size={14} className="mt-0.5 shrink-0 text-[#748078]"/><div><p className="text-[12px] font-medium">{eventLabel(String(event.event_type || "Modification"))}</p><p className="mt-1 text-[11px] text-[#748078]">{formatDate(event.created_at)} · {String(event.actor_name || "Membre de l’agence")}</p>{event.reason&&<p className="mt-1 text-[11px] text-[#748078]">{String(event.reason)}</p>}</div></div>)}{!events.length&&<p className="py-8 text-center text-[13px] text-[#758078]">Aucune modification enregistrée.</p>}</div>;
}

function InfoRow({ label: title, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 text-[12px]"><span className="text-[#748078]">{title}</span><span className="text-right font-medium text-[#303b34]">{value}</span></div>;
}

function hasActivePricing(detail: ServiceRecord) {
  return Boolean(detail.pricing?.some(price => String(price.status || "").toUpperCase() === "ACTIVE"));
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function eventLabel(value: string) {
  return ({ SERVICE_CREATED: "Service créé", SERVICE_UPDATED: "Informations du service modifiées", SERVICE_ACTIVE: "Service activé", SERVICE_INACTIVE: "Service désactivé", SERVICE_SUSPENDED: "Service suspendu", ROUTE_CONFIGURED: "Route associée au service", CONDITION_CONFIGURED: "Conditions du service modifiées" } as Record<string,string>)[value] || value.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());
}

function modeLabel(mode: string) {
  return ({ AIR: "Aérien", SEA: "Maritime", ROAD: "Routier", RAIL: "Ferroviaire", EXPRESS: "Express", OTHER: "Autre", MULTIMODAL: "Multimodal" } as Record<string, string>)[mode] || mode;
}

function ServiceCreationForm({
  onSubmit,
  step,
  draft,
  offices,
  selectedOfficeId,
  actionError,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  step: 1 | 2;
  draft: ServiceDraft | null;
  offices: OfficeContext["offices"];
  selectedOfficeId: string;
  actionError: string;
}) {
  return <form id="create-transport-service" onSubmit={onSubmit} className="mx-auto grid w-full max-w-[680px] gap-4">
    <div className="grid grid-cols-2 text-[12px]">
      <div className={`border-b-2 pb-2 ${step === 1 ? "border-[#16855f] font-semibold text-[#25292e]" : "border-[#e5e8e9] text-[#7a8288]"}`}><span className="mr-2">1</span>Configuration</div>
      <div className={`border-b-2 pb-2 text-right ${step === 2 ? "border-[#16855f] font-semibold text-[#25292e]" : "border-[#e5e8e9] text-[#7a8288]"}`}><span className="mr-2">2</span>Vérification</div>
    </div>

    {step === 1 ? <>
      <section className="grid gap-3">
        <h3 className="text-[14px] font-semibold text-[#25292e]">Informations générales</h3>
        <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Nom du service *
          <input className={field} name="service_name" required minLength={2} maxLength={160} defaultValue={draft?.service_name || ""} placeholder="Ex. : Cargo aérien standard" />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Type de service *
          <select className={field} name="shipping_mode" required defaultValue={draft?.shipping_mode || "AIR"}>
            <option value="AIR">Transport aérien</option><option value="SEA">Transport maritime</option><option value="EXPRESS">Express</option><option value="ROAD">Transport routier</option><option value="RAIL">Transport ferroviaire</option><option value="OTHER">Autre</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Description
          <textarea className={`${field} h-auto min-h-[76px] py-2.5`} name="description" maxLength={1000} defaultValue={draft?.description || ""} placeholder="Décrivez le service et les marchandises concernées…" />
        </label>
      </section>

      <section className="grid gap-3 border-t border-[#e8ebec] pt-4">
        <h3 className="text-[14px] font-semibold text-[#25292e]">Délais de transport</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Minimum (jours)
            <input className={field} type="number" name="eta_min_days" min="0" max="365" defaultValue={draft?.eta_min_days ?? ""} placeholder="Ex. : 8" />
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Maximum (jours)
            <input className={field} type="number" name="eta_max_days" min="0" max="365" defaultValue={draft?.eta_max_days ?? ""} placeholder="Ex. : 12" />
          </label>
        </div>
        <p className="text-[11px] leading-4 text-[#78828a]">Ces délais sont indicatifs. Ils ne constituent pas une date d’arrivée garantie ni un ETA de suivi.</p>
      </section>

      <section className="grid gap-3 border-t border-[#e8ebec] pt-4">
        <h3 className="text-[14px] font-semibold text-[#25292e]">Organisation et facturation</h3>
        <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Unité de facturation habituelle
          <select className={field} name="billing_unit" defaultValue={draft?.billing_unit || "KG"}><option value="KG">Kilogramme (kg)</option><option value="CBM">Volume (m³)</option><option value="PACKAGE">Colis</option><option value="FLAT">Forfait</option></select>
        </label>
        <p className="-mt-2 text-[11px] text-[#78828a]">Les montants et paliers seront configurés dans Gestion → Tarification.</p>
        <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Bureau responsable
          <select className={field} name="office_id" defaultValue={draft?.office_id || selectedOfficeId}><option value="">Tous les bureaux autorisés</option>{offices.map((office) => <option key={office.location_id} value={office.location_id}>{office.city || office.name}</option>)}</select>
        </label>
      </section>

      <section className="grid gap-3 border-t border-[#e8ebec] pt-4">
        <h3 className="text-[14px] font-semibold text-[#25292e]">Conditions du service</h3>
        <p className="-mt-2 text-[11px] text-[#78828a]">Restrictions et marchandises non acceptées</p>
        <label className="sr-only" htmlFor="service-restrictions">Restrictions et marchandises non acceptées</label>
        <textarea id="service-restrictions" className={`${field} h-auto min-h-[72px] py-2.5`} name="restrictions" maxLength={2000} defaultValue={draft?.restrictions || ""} placeholder="Définir les restrictions applicables…" />
        <label className="grid gap-1.5 text-[12px] font-medium text-[#414950]">Instructions pour les clients
          <textarea className={`${field} h-auto min-h-[72px] py-2.5`} name="customer_instructions" maxLength={2000} defaultValue={draft?.customer_instructions || ""} placeholder="Ex. : consignes de dépôt et préparation des colis…" />
        </label>
      </section>

      <section className="grid gap-1 border-t border-[#e8ebec] pt-4">
        <h3 className="mb-1 text-[14px] font-semibold text-[#25292e]">Disponibilité</h3>
        <ToggleRow name="service_active" defaultChecked={draft?.service_active ?? true} title="Service actif" detail="Disponible pour les nouvelles opérations internes." />
        <ToggleRow name="public_visible" defaultChecked={draft?.public_visible ?? false} title="Visible dans les informations clients" detail="L’IA peut utiliser uniquement les informations publiées et vérifiées." />
      </section>
    </> : <section className="grid gap-4">
      <h3 className="text-[14px] font-semibold text-[#25292e]">Vérifiez les informations du service</h3>
      {draft ? <>
        <ReviewRow label="Nom du service" value={draft.service_name} />
        <ReviewRow label="Type de service" value={modeLabel(draft.shipping_mode)} />
        <ReviewRow label="Description" value={draft.description || "Non renseignée"} />
        <ReviewRow label="Délai indicatif" value={draft.eta_min_days === null && draft.eta_max_days === null ? "Non renseigné" : `${draft.eta_min_days ?? "…"} à ${draft.eta_max_days ?? "…"} jours`} />
        <ReviewRow label="Unité de facturation" value={{ KG: "Kilogramme (kg)", CBM: "Volume (m³)", PACKAGE: "Colis", FLAT: "Forfait" }[draft.billing_unit] || draft.billing_unit} />
        <ReviewRow label="Bureau responsable" value={offices.find((office) => office.location_id === draft.office_id)?.city || offices.find((office) => office.location_id === draft.office_id)?.name || "Tous les bureaux autorisés"} />
        <ReviewRow label="Restrictions" value={draft.restrictions || "Aucune restriction précisée"} />
        <ReviewRow label="Instructions clients" value={draft.customer_instructions || "Aucune instruction précisée"} />
        <ReviewRow label="Disponibilité" value={draft.service_active ? "Service actif" : "Inactif"} />
        <ReviewRow label="Visibilité client" value={draft.public_visible ? "Visible" : "Interne uniquement"} />
        <p className="border border-[#dfe3e4] bg-[#f8f9f9] px-3 py-3 text-[12px] leading-5 text-[#697178]">Les tarifs détaillés et les routes associées se configurent ensuite dans Gestion. La création du service ne crée pas automatiquement de prix.</p>
      </> : <p className="text-[13px] text-[#697178]">Revenez à la configuration puis vérifiez les champs saisis.</p>}
    </section>}
    {actionError && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{actionError}</p>}
  </form>;
}

function RouteCreationForm({ services, catalog, onSubmit, draft }: { services: Service[]; catalog: ServiceCatalog | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void; draft: RouteDraft | null }) {
  const routeService = services.find(service => service.id === draft?.service_id);
  return <form id="create-commercial-route" onSubmit={onSubmit} className="mx-auto grid w-full max-w-[680px] gap-4">
    <div className="grid grid-cols-2 text-[12px]"><div className="border-b-2 border-[#16855f] pb-2 font-semibold text-[#25292e]">1　Configuration</div><div className="border-b-2 border-[#e5e8e9] pb-2 text-right text-[#7a8288]">2　Vérification</div></div>
    <section className="grid gap-3"><h3 className="text-[14px] font-semibold text-[#25292e]">1. Itinéraire</h3>
      <p className="text-[12px] font-semibold text-[#414950]">◎　Origine</p>
      <FormGeographyFields countryName="origin_country" cityName="origin_city" countryLabel="Pays de départ *" cityLabel="Ville de départ *" initialCountry={draft?.origin_country || ""} initialCity={draft?.origin_city || ""} required className={field} fieldClassName={label}/>
      <div className="py-1 text-center text-[#87928b]">↓</div>
      <p className="text-[12px] font-semibold text-[#414950]">◎　Destination</p>
      <FormGeographyFields countryName="destination_country" cityName="destination_city" countryLabel="Pays de destination *" cityLabel="Ville de destination *" initialCountry={draft?.destination_country || ""} initialCity={draft?.destination_city || ""} required className={field} fieldClassName={label}/>
      <label className={label}>Nom de la route <span className="font-normal text-[#87928b]">(facultatif)</span><input className={field} name="route_name" maxLength={160} defaultValue={draft?.route_name || ""} placeholder="Ex. Guangzhou → Kinshasa"/><span className="text-[11px] font-normal text-[#78828a]">Si vide, le nom sera généré à partir des villes.</span></label>
    </section>
    <section className="grid gap-3 border-t border-[#e8ebec] pt-4"><h3 className="text-[14px] font-semibold text-[#25292e]">2. Service de transport</h3>
      <label className={label}>Service associé *<select className={field} name="service_id" required defaultValue={draft?.service_id || ""}><option value="">Sélectionner un service actif</option>{services.map(service=><option key={service.id} value={service.id}>{service.service_name} · {modeLabel(service.shipping_mode)}</option>)}</select><span className="text-[11px] font-normal text-[#78828a]">Seuls les services actifs et autorisés apparaissent ici.</span></label>
      {!services.length && <p className="text-[12px] text-amber-700">Aucun service actif disponible. Activez ou créez un service avant de configurer sa route.</p>}
    </section>
    <section className="grid gap-3 border-t border-[#e8ebec] pt-4"><h3 className="text-[14px] font-semibold text-[#25292e]">3. Points opérationnels</h3>
      <label className={label}>Entrepôt de départ<select className={field} name="origin_warehouse_id" defaultValue={draft?.origin_warehouse_id || ""}><option value="">Aucun entrepôt sélectionné</option>{(catalog?.warehouses || []).map(item=><option key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ""}</option>)}</select></label>
      <label className={label}>Bureau de destination<select className={field} name="destination_office_id" defaultValue={draft?.destination_office_id || ""}><option value="">Aucun bureau sélectionné</option>{(catalog?.offices || []).map(item=><option key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ""}</option>)}</select><span className="text-[11px] font-normal text-[#78828a]">Les choix sont limités aux implantations autorisées de l’agence.</span></label>
    </section>
    <section className="grid gap-3 border-t border-[#e8ebec] pt-4"><h3 className="text-[14px] font-semibold text-[#25292e]">4. Délais et fréquence</h3>
      <div className="grid grid-cols-2 gap-3"><label className={label}>Délai min. (jours)<input className={field} type="number" name="eta_min_days" min="0" max="365" defaultValue={draft?.eta_min_days ?? routeService?.eta_min_days ?? ""} placeholder="Ex. : 8"/></label><label className={label}>Délai max. (jours)<input className={field} type="number" name="eta_max_days" min="0" max="365" defaultValue={draft?.eta_max_days ?? routeService?.eta_max_days ?? ""} placeholder="Ex. : 12"/></label></div>
      <label className={label}>Fréquence habituelle des départs<select className={field} name="frequency" defaultValue={draft?.frequency || "PROGRAMMED"}><option value="PROGRAMMED">Selon programmation</option><option value="DAILY">Quotidienne</option><option value="WEEKLY">Hebdomadaire</option><option value="MONTHLY">Mensuelle</option></select><span className="text-[11px] font-normal leading-4 text-[#78828a]">La fréquence ne crée pas automatiquement de départs. Ils se gèrent dans Opérations → Calendrier des départs.</span></label>
    </section>
    <section className="grid gap-3 border-t border-[#e8ebec] pt-4"><h3 className="text-[14px] font-semibold text-[#25292e]">5. Informations complémentaires</h3><label className={label}>Instructions et conditions<textarea className={`${field} h-auto min-h-[86px] py-2.5`} name="instructions" maxLength={2000} defaultValue={draft?.instructions || ""} placeholder="Ex. : informations de dépôt, conditions de transport…"/></label><ToggleRow name="route_active" title="Route active" detail="Autoriser son utilisation pour de nouvelles opérations." defaultChecked={draft?.route_active ?? true}/></section>
  </form>;
}

function RouteReview({ draft, services, catalog }: { draft: RouteDraft | null; services: Service[]; catalog: ServiceCatalog | null }) {
  if (!draft) return <p className="text-[13px] text-[#697178]">Revenez à la configuration puis vérifiez les champs saisis.</p>;
  const service=services.find(item=>item.id===draft.service_id);
  const warehouse=catalog?.warehouses.find(item=>item.id===draft.origin_warehouse_id);
  const office=catalog?.offices.find(item=>item.id===draft.destination_office_id);
  const frequency=({PROGRAMMED:"Selon programmation",DAILY:"Quotidienne",WEEKLY:"Hebdomadaire",MONTHLY:"Mensuelle"} as Record<string,string>)[draft.frequency] || draft.frequency;
  return <div className="mx-auto grid w-full max-w-[680px] gap-4"><div className="grid grid-cols-2 text-[12px]"><div className="border-b-2 border-[#16855f] pb-2 text-[#637068]">1　Configuration</div><div className="border-b-2 border-[#16855f] pb-2 text-right font-semibold text-[#25292e]">2　Vérification</div></div><h3 className="text-[14px] font-semibold">Vérifiez les informations de la route</h3><section className="grid gap-3 rounded-lg border border-[#e5e9e7] p-4"><h4 className="text-[12px] font-semibold">Itinéraire</h4><ReviewRow label="Origine" value={`${draft.origin_city}, ${draft.origin_country}`}/><ReviewRow label="Destination" value={`${draft.destination_city}, ${draft.destination_country}`}/><ReviewRow label="Nom de la route" value={draft.route_name || `${draft.origin_city} → ${draft.destination_city}`}/></section><section className="grid gap-3 rounded-lg border border-[#e5e9e7] p-4"><h4 className="text-[12px] font-semibold">Service et points opérationnels</h4><ReviewRow label="Service associé" value={service?.service_name || "Service non trouvé"}/><ReviewRow label="Entrepôt de départ" value={warehouse?.name || "Non précisé"}/><ReviewRow label="Bureau de destination" value={office?.name || "Non précisé"}/></section><section className="grid gap-3 rounded-lg border border-[#e5e9e7] p-4"><h4 className="text-[12px] font-semibold">Délais et fonctionnement</h4><ReviewRow label="Délai indicatif" value={draft.eta_min_days == null && draft.eta_max_days == null ? "À préciser" : `${draft.eta_min_days ?? "…"} à ${draft.eta_max_days ?? "…"} jours`}/><ReviewRow label="Fréquence habituelle" value={frequency}/><ReviewRow label="Disponibilité" value={draft.route_active ? "Active" : "Inactive, non disponible aux opérations"}/><ReviewRow label="Instructions" value={draft.instructions || "Aucune instruction particulière"}/></section><p className="bg-[#f8f9f9] px-3 py-3 text-[12px] leading-5 text-[#697178]">La route organise le corridor et le service associé. Les départs réels restent gérés séparément dans le calendrier des opérations.</p></div>;
}

function ToggleRow({ name, title, detail, defaultChecked = false }: { name: string; title: string; detail: string; defaultChecked?: boolean }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
    <span><span className="block text-[12px] font-medium text-[#30363a]">{title}</span><span className="mt-1 block text-[11px] leading-4 text-[#78828a]">{detail}</span></span>
    <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 shrink-0 accent-[#111111]" />
  </label>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 border-b border-[#edf0f1] pb-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4"><span className="text-[12px] text-[#78828a]">{label}</span><span className="break-words text-[13px] font-medium text-[#30363a]">{value}</span></div>;
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="grid justify-items-center rounded-xl border border-dashed border-[#dce5df] bg-[#fbfdfb] px-6 py-10 text-center">
    <div className="grid h-11 w-11 place-items-center rounded-full bg-[#edf6f0] text-[#4a745a]"><Boxes size={18} /></div>
    <h4 className="mt-3 text-[14px] font-semibold text-[#303b34]">{title}</h4>
    <p className="mt-1 max-w-md text-[12px] leading-5 text-[#768179]">{detail}</p>
  </div>;
}
