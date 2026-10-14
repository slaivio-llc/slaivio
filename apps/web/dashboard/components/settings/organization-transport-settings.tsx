"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Boxes, MapPin, Plus, Route as RouteIcon, Truck } from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { FormGeographyFields } from "@/components/ui/geography-fields";
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
  transitionService,
} from "@/services/service-catalog";

type CatalogData = { routes: Route[]; services: Service[] };
type SettingSection = "services" | "routes";

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

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setActionError("");
    try {
      await createCatalogService({
        service_name: String(form.get("service_name") || "").trim(),
        shipping_mode: String(form.get("shipping_mode") || "AIR"),
        description: String(form.get("description") || "").trim() || null,
        category: "TRANSPORT",
        service_type: "TRANSPORT",
      });
      setCreateOpen(false);
      setNotice("Service créé. Associez-le à une route pour le proposer lors de la réception d’un colis.");
      await load();
    } catch (exception) {
      setActionError(errorMessage(exception));
    } finally {
      setSaving(false);
    }
  }

  async function saveRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceIds = form.getAll("service_ids").map(String);
    if (!serviceIds.length) {
      setActionError("Associez au moins un service actif à cette route.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      await createRoute({
        route_name: String(form.get("route_name") || "").trim() || null,
        origin_country: String(form.get("origin_country") || "").trim(),
        origin_city: String(form.get("origin_city") || "").trim(),
        destination_country: String(form.get("destination_country") || "").trim(),
        destination_city: String(form.get("destination_city") || "").trim(),
        service_ids: serviceIds,
      });
      setCreateOpen(false);
      setNotice("Route enregistrée. Les services associés sont maintenant disponibles pour les nouvelles opérations.");
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
      const next = ["INACTIVE", "SUSPENDED"].includes(service.status) ? "ACTIVE" : "INACTIVE";
      await transitionService(service.id, next, "Modification depuis les paramètres de l’agence");
      setNotice(next === "ACTIVE" ? "Service réactivé." : "Service désactivé. Son historique est conservé.");
      await load();
    } catch (exception) {
      setActionError(errorMessage(exception));
    }
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
            <OperationButton variant="primary" className="h-10 shrink-0 px-4" onClick={() => { setActionError(""); setCreateOpen(true); }}>
              <Plus size={16} />{isServices ? "Ajouter un service" : "Ajouter une route"}
            </OperationButton>
          </PermissionGuard>
        </div>
        <div className="grid gap-3 p-4 sm:p-5">
          {isServices
            ? data.services.map(service => (
              <article key={service.id} className="flex flex-col gap-4 rounded-xl border border-[#e8eeea] p-4 transition hover:border-[#c8ddd1] sm:flex-row sm:items-center">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1f6f3] text-[#416b56]"><Truck size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#26332d]">{service.service_name}</h4>
                    <StatusPill label={statusLabel(service.status, service.active)} active={service.active !== false && ["ACTIVE", "LIMITED"].includes(service.status)} />
                  </div>
                  <p className="mt-1 text-[12px] text-[#748078]">{modeLabel(service.shipping_mode)} · {service.route_count || 0} route{service.route_count === 1 ? "" : "s"} associée{service.route_count === 1 ? "" : "s"}</p>
                </div>
                <PermissionGuard permission="services.suspend">
                  <button type="button" onClick={() => void toggleService(service)} className="h-9 rounded-lg border border-[#dbe3de] px-3 text-[12px] font-semibold text-[#48574e] hover:bg-[#f5f8f6]">
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
        open={createOpen}
        close={() => { if (!saving) setCreateOpen(false); }}
        title={isServices ? "Ajouter un service" : "Ajouter une route"}
        description={isServices ? "Créez une prestation sans la lier à un seul trajet." : "Associez un ou plusieurs services à cette liaison commerciale."}
        placement="center"
        width="max-w-2xl"
        bodyClassName="!bg-[#f5f8f6] p-4 sm:p-6"
        footer={<div className="flex justify-end gap-2">
          <OperationButton type="button" disabled={saving} onClick={() => setCreateOpen(false)}>Annuler</OperationButton>
          <OperationButton form={isServices ? "create-transport-service" : "create-commercial-route"} type="submit" variant="primary" disabled={saving}>
            {saving ? "Enregistrement…" : isServices ? "Créer le service" : "Créer la route"}
          </OperationButton>
        </div>}
      >
        {isServices
          ? <form id="create-transport-service" onSubmit={saveService} className="mx-auto grid w-full max-w-xl gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">Prestation de l’agence</p>
            <label className={label}>Nom du service *
              <input className={field} name="service_name" required minLength={2} maxLength={160} placeholder="Ex. Fret aérien express" />
            </label>
            <label className={label}>Mode de transport *
              <select className={field} name="shipping_mode" required defaultValue="AIR">
                <option value="AIR">Aérien</option><option value="SEA">Maritime</option><option value="ROAD">Routier</option><option value="RAIL">Ferroviaire</option><option value="OTHER">Autre</option>
              </select>
            </label>
            <label className={label}>Description <span className="font-normal text-[#87928b]">· facultatif</span>
              <textarea className={`${field} min-h-24 py-3`} name="description" maxLength={1000} placeholder="Précisez la prestation proposée." />
            </label>
          </form>
          : <form id="create-commercial-route" onSubmit={saveRoute} className="mx-auto grid w-full max-w-xl gap-5">
            <section className="grid gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-700">Liaison commerciale</p>
              <label className={label}>Nom personnalisé <span className="font-normal text-[#87928b]">· facultatif</span>
                <input className={field} name="route_name" maxLength={160} placeholder="Ex. Chine → Kinshasa" />
              </label>
              <div className="grid gap-4 rounded-xl bg-[#f7faf8] p-4 sm:grid-cols-2">
                <FormGeographyFields
                  countryName="origin_country"
                  cityName="origin_city"
                  countryLabel="Pays d’origine"
                  cityLabel="Ville d’origine"
                  required
                  className={field}
                  fieldClassName={label}
                />
                <FormGeographyFields
                  countryName="destination_country"
                  cityName="destination_city"
                  countryLabel="Pays de destination"
                  cityLabel="Ville de destination"
                  required
                  className={field}
                  fieldClassName={label}
                />
              </div>
            </section>
            <fieldset className="grid gap-2 rounded-2xl border border-[#e2e9e5] bg-white p-5 sm:p-6">
              <legend className="px-1 text-[13px] font-semibold text-[#414d46]">Services proposés sur cette route *</legend>
              {activeServices.map(service => <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e8eeea] px-3 py-2.5 text-[13px] hover:bg-[#f8fbf9]">
                <input className="h-4 w-4 accent-[#16855f]" type="checkbox" name="service_ids" value={service.id} />
                <span className="min-w-0 flex-1 font-medium text-[#303b34]">{service.service_name}</span>
                <span className="text-[11px] text-[#7b867f]">{modeLabel(service.shipping_mode)}</span>
              </label>)}
              {!activeServices.length && <p className="text-[12px] leading-5 text-[#758078]">Créez d’abord un service actif dans Paramètres → Services.</p>}
            </fieldset>
          </form>}
        {actionError && <p role="alert" className="mx-auto mt-3 max-w-xl rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{actionError}</p>}
      </OperationDrawer>
    </div>
  );
}

function modeLabel(mode: string) {
  return ({ AIR: "Aérien", SEA: "Maritime", ROAD: "Routier", RAIL: "Ferroviaire", EXPRESS: "Express", OTHER: "Autre", MULTIMODAL: "Multimodal" } as Record<string, string>)[mode] || mode;
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
