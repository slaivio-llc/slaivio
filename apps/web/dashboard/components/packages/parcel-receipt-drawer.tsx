"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { useEffect, useRef, useState, type FormEvent } from "react";
import { InlineClientCreator } from "@/components/clients/inline-client-creator";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationButton } from "@/components/ui/operation-controls";
import { listClients, type ClientRecord } from "@/services/clients";
import { receiptCatalog, type Route, type Service } from "@/services/route-catalog";
import type { ReferenceItem } from "@/services/references";
import type { OperationalSettings } from "@/services/organization-admin";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { goodsClassificationLabels } from "@/services/goods-classification";


export function ParcelPackageCreateDrawer({ saving, error, onClose, onSubmit }: {
  warehouses: ReferenceItem[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  useDashboardMessages();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [policies,setPolicies]=useState<OperationalSettings['settings']>({});
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [originKey, setOriginKey] = useState("");
  const [physicallyReceived, setPhysicallyReceived] = useState(true);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [clientError, setClientError] = useState("");
  const submitting = useRef(false);
  useEffect(() => { if (!saving) submitting.current = false; }, [saving, error]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCatalogError("");
    receiptCatalog().then(result => {
      if (!active) return;
      const available = result.routes.filter(route => route.active !== false);
      setRoutes(available);
      setPolicies(result.operational_settings?.settings || {});
      setServices(result.services.filter(service =>
        service.active !== false && ["ACTIVE", "LIMITED"].includes(service.status),
      ));
    }).catch(() => {
      if (active) setCatalogError("Impossible de charger les services et routes du bureau.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    setClientLoading(true);
    setClientError("");
    listClients({ page_size: 50, sort: "name_asc" })
      .then(result => { if (active) setClients(result.items); })
      .catch(() => { if (active) setClientError("Liste des clients indisponible."); })
      .finally(() => { if (active) setClientLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const service = services.find(item => item.id === serviceId);
  const serviceRoutes = service
    ? routes.filter(item => service.route_ids?.length
      ? service.route_ids.includes(item.id)
      : item.id === service.route_id)
    : [];
  const route = serviceRoutes.find(item => item.id === routeId);
  const routeOriginKey = (item: Route) => JSON.stringify([item.origin_country, item.origin_city || ""]);
  const origins = Array.from(new Map(serviceRoutes.map(item => [routeOriginKey(item), item])).entries());
  const originRoutes = serviceRoutes.filter(item => routeOriginKey(item) === originKey);
  const choices = selectedClient
    ? [selectedClient, ...clients.filter(item => item.id !== selectedClient.id)] : clients;
  const canSubmit = Boolean(selectedClient && service && route && !loading && !catalogError && !saving);

  return <OperationDrawer open close={() => { if (!saving) onClose(); }} title={dashboardText("Nouveau colis")}
    description={dashboardText("Enregistrez la réception, puis affectez le colis à un départ.")}
    placement="center" width="max-w-4xl" panelClassName="min-h-[min(680px,calc(100dvh-48px))]" bodyClassName="sm:!px-8 sm:!py-7" footer={<div className="mx-auto flex w-full max-w-3xl justify-end gap-2">
      <OperationButton type="button" disabled={saving} onClick={onClose}>{dashboardText("Annuler")}</OperationButton>
      <OperationButton form="parcel-receipt" type="submit" variant="primary" disabled={!canSubmit}>
        {saving ? dashboardText("Enregistrement…") : dashboardText("Enregistrer le colis")}
      </OperationButton>
    </div>}>
    <form id="parcel-receipt" className="mx-auto grid w-full max-w-3xl gap-5" onSubmit={event => {
      if (!canSubmit || submitting.current) { event.preventDefault(); return; }
      submitting.current = true;
      onSubmit(event);
    }}>
      <input type="hidden" name="receipt_flow" value="parcel" />
      <section className="grid gap-2 border-b border-slate-200 pb-5">
        <label className="grid gap-1.5 text-sm font-medium"><span>{dashboardText("Client ")}<span className="text-red-600">*</span></span>
          <select name="client_id" required className={field} value={selectedClient?.id || ""}
            onChange={event => setSelectedClient(choices.find(item => item.id === event.target.value) || null)}>
            <option value="">{clientLoading ? dashboardText("Recherche…") : dashboardText("Sélectionner un client")}</option>
            {choices.map(client => <option key={client.id} value={client.id}>
              {client.display_name || client.name || client.phone} · {client.phone || client.whatsapp_phone || dashboardText("Sans téléphone")}
            </option>)}
          </select>
        </label>
        {!clientLoading && !clientError && !clients.length && <p className="text-xs text-[#68727d]">{dashboardText("Aucun client enregistré pour cette agence.")}</p>}
        {clientError && <p role="alert" className="text-sm text-red-700">{clientError} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>{dashboardText("Réessayer")}</button></p>}
        <div className="flex justify-end"><PermissionGuard permission="clients.create"><InlineClientCreator onCreated={client => { setSelectedClient(client); setClientError(""); }} /></PermissionGuard></div>
      </section>
      <fieldset disabled={saving || loading} className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-2">
        <legend className="sr-only">{dashboardText("Informations du colis")}</legend>
        {catalogError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{catalogError} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>{dashboardText("Réessayer")}</button></p>}
        {!loading && !catalogError && !services.length && <p className="text-sm text-[#68727d] sm:col-span-2">{dashboardText("Aucun service actif n’est configuré pour cette agence.")}</p>}
        <label className="grid gap-1.5 text-sm sm:col-span-2">{dashboardText("Référence fournisseur / Tracking (facultatif)")}<input name="supplier_tracking" maxLength={180} className={field} placeholder={dashboardText("Ex. SF123456789")} /><span className="text-xs text-[#68727d]">{dashboardText("La référence interne Slaivio sera générée automatiquement.")}</span></label>
        <label className="grid gap-1.5 text-sm"><span>{dashboardText("Service ")}<span className="text-red-600">*</span></span>
          <select name="shipping_service_id" required className={field} value={serviceId} onChange={event => { setServiceId(event.target.value); setOriginKey(""); setRouteId(""); }}>
            <option value="">{loading ? dashboardText("Chargement…") : dashboardText("Sélectionner un service")}</option>
            {services.map(item => <option key={item.id} value={item.id}>{item.service_name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm"><span>{dashboardText("Nombre de colis ")}<span className="text-red-600">*</span></span><input name="pieces_count" type="number" min="1" step="1" required defaultValue="1" className={field} /></label>
        <label className="grid gap-1.5 text-sm">{dashboardText("Type de marchandise")}<select name="goods_classification" required defaultValue="ORDINARY_GOODS" className={field}>{Object.entries(goodsClassificationLabels).map(([code,label])=><option key={code} value={code}>{dashboardText(label)}</option>)}</select><span className="text-xs text-[#68727d]">{dashboardText("Détermine le tarif selon les règles de votre agence, le service et la route.")}</span></label>
        <label className="grid gap-1.5 text-sm">{dashboardText("Catégorie de marchandise")}<input name="category" maxLength={120} required={policies.parcel_receipt_rules?.category_required} className={field} placeholder={dashboardText("Ex. Vêtements")} /></label>
        <label className="grid gap-1.5 text-sm">{dashboardText("Conditionnement")}<select name="package_type" required={policies.parcel_receipt_rules?.packaging_required} defaultValue="carton" className={field}><option value="">{dashboardText("Sélectionner")}</option><option value="carton">{dashboardText("Carton")}</option><option value="sac">{dashboardText("Sac")}</option><option value="palette">{dashboardText("Palette")}</option><option value="caisse">{dashboardText("Caisse")}</option><option value="document">{dashboardText("Document")}</option><option value="lot">{dashboardText("Lot")}</option><option value="other">{dashboardText("Autre")}</option></select></label>
        {policies.goods_restrictions?.agent_instructions && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">{policies.goods_restrictions.agent_instructions}</p>}
        <label className="grid gap-1.5 text-sm"><span>{dashboardText("Origine ")}<span className="text-red-600">*</span></span>
          <select required className={field} value={originKey} disabled={!serviceRoutes.length} onChange={event => { const nextKey = event.target.value; setOriginKey(nextKey); setRouteId(serviceRoutes.find(item => routeOriginKey(item) === nextKey)?.id || ""); }}>
            <option value="">{service ? dashboardText("Sélectionner une origine") : dashboardText("Choisissez d’abord le service")}</option>
            {origins.map(([key, item]) => <option key={key} value={key}>{item.origin_city || item.origin_country}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm"><span>{dashboardText("Destination ")}<span className="text-red-600">*</span></span>
          <select name="route_id" required className={field} value={route?.id || ""} disabled={!originRoutes.length} onChange={event => setRouteId(event.target.value)}>
            {!originRoutes.length && <option value="">{originKey ? dashboardText("Aucune destination disponible") : dashboardText("Choisissez d’abord l’origine")}</option>}
            {originRoutes.map(item => <option key={item.id} value={item.id}>{item.destination_city || item.destination_country}</option>)}
          </select>
        </label>
        {service && !serviceRoutes.length && <p role="status" className="text-xs text-amber-800 sm:col-span-2">{dashboardText("Ce service actif n’a aucune route disponible. Configurez une route pour ce service avant de créer un colis.")}</p>}
        <label className="grid gap-1.5 text-sm sm:col-span-2">{dashboardText("Poids (kg)")}<input name="weight_kg" type="number" min="0.001" step="0.001" className={field} placeholder={dashboardText("Ex. 12,5")} /></label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">{dashboardText("Volume (m³)")}<input name="volume_cbm" type="number" min="0.000001" step="0.000001" className={field} placeholder={dashboardText("Pour le transport maritime")} />{policies.parcel_receipt_rules?.allow_unmeasured === false && <span className="text-xs text-slate-500">{dashboardText("Un poids ou un volume est obligatoire pour enregistrer la réception.")}</span>}</label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">{dashboardText("Description (facultative)")}<textarea name="description" maxLength={260} className={`${field} min-h-20 resize-y`} placeholder={dashboardText("Ex. Vêtements, accessoires…")} /></label>
        <p className="text-xs leading-5 text-[#68727d] sm:col-span-2">{policies.parcel_receipt_rules?.auto_rate_lookup===false?dashboardText("Le calcul automatique est désactivé dans les paramètres de votre agence. Le tarif devra être renseigné depuis la fiche du colis."):dashboardText("À l’enregistrement, Slaivio applique le tarif de votre agence selon la marchandise, le conditionnement et les mesures. Sans tarif applicable ou mesures suffisantes, le montant restera à compléter : aucun prix ne sera inventé.")}</p>
      </fieldset>
      {policies.parcel_receipt_rules?.allow_photos!==false&&<PermissionGuard permission="packages.update"><section className="grid gap-3 border-b border-slate-200 pb-5"><label className="grid gap-1.5 text-sm">{dashboardText("Photos de réception")}<input name="reception_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm"/><span className="text-xs text-[#68727d]">{dashboardText("Jusqu’à 10 photos, 25 Mo chacune. Vous pouvez aussi les ajouter depuis la fiche du colis.")}</span></label><label className="flex items-center gap-2 text-[13px]"><input name="share_reception_photos" type="checkbox" className="h-4 w-4 accent-emerald-700"/>{dashboardText("Afficher ces photos dans le suivi public du client")}</label></section></PermissionGuard>}
      <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <span><span className="block text-sm font-medium">{dashboardText("Colis physiquement reçu")}</span><span className="mt-1 block text-xs text-[#68727d]">{dashboardText("Confirmer la réception à l’entrepôt")}</span></span>
        <input name="physical_received" type="checkbox" checked={physicallyReceived} onChange={event => setPhysicallyReceived(event.target.checked)} className="h-4 w-4 accent-emerald-700" />
      </label>
      <details className="group border-b border-slate-200 pb-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">{dashboardText("Informations complémentaires")}<span aria-hidden="true" className="text-slate-500 transition group-open:rotate-180">⌄</span></summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><div className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-600">{dashboardText("Statut initial")}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{physicallyReceived ? dashboardText("Reçu") : dashboardText("À recevoir")}</span></div><p className="mt-2 text-xs text-[#68727d]">{dashboardText("Le colis n’est pas automatiquement affecté à une expédition.")}</p></div>
          <label className="grid gap-1.5 text-sm sm:col-span-2">{dashboardText("Emplacement de stockage (facultatif)")}<input name="warehouse_location" maxLength={160} className={field} placeholder={dashboardText("Ex. Zone A - B3")} /></label>
        </div>
      </details>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{dashboardText(error)}</p>}
    </form>
  </OperationDrawer>;
}
