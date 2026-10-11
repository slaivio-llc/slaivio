"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { InlineClientCreator } from "@/components/clients/inline-client-creator";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationButton } from "@/components/ui/operation-controls";
import { listClients, type ClientRecord } from "@/services/clients";
import { catalog, type Route, type Service } from "@/services/route-catalog";
import type { ReferenceItem } from "@/services/references";

const field = "h-9 w-full rounded-lg border border-[#dce1e6] bg-white px-3 text-sm disabled:bg-[#f6f7f8]";

export function ParcelPackageCreateDrawer({ saving, error, onClose, onSubmit }: {
  warehouses: ReferenceItem[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [query, setQuery] = useState("");
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
    catalog().then(result => {
      if (!active) return;
      const available = result.routes.filter(route => route.active !== false);
      setRoutes(available);
      setServices(result.services.filter(service => available.some(route => route.id === service.route_id)));
    }).catch(() => {
      if (active) setCatalogError("Impossible de charger les services et routes du bureau.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    setClientLoading(true);
    setClientError("");
    const timer = setTimeout(() => {
      listClients({ q: query.trim(), page_size: 50, sort: "name_asc" })
        .then(result => { if (active) setClients(result.items); })
        .catch(() => { if (active) setClientError("Recherche client indisponible."); })
        .finally(() => { if (active) setClientLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, reload]);

  const service = services.find(item => item.id === serviceId);
  // The current commercial model binds each service to one configured route.
  const route = routes.find(item => item.id === service?.route_id);
  const choices = selectedClient
    ? [selectedClient, ...clients.filter(item => item.id !== selectedClient.id)] : clients;
  const canSubmit = Boolean(selectedClient && service && route && !loading && !catalogError && !saving);

  return <OperationDrawer open close={() => { if (!saving) onClose(); }} title="Enregistrer un colis"
    description="Réception dans le bureau actif. La référence interne est générée automatiquement."
    width="max-w-3xl" footer={<div className="flex justify-end gap-2">
      <OperationButton type="button" disabled={saving} onClick={onClose}>Annuler</OperationButton>
      <OperationButton form="parcel-receipt" type="submit" variant="primary" disabled={!canSubmit}>
        {saving ? "Enregistrement…" : "Enregistrer le colis"}
      </OperationButton>
    </div>}>
    <form id="parcel-receipt" className="grid gap-6" onSubmit={event => {
      if (!canSubmit || submitting.current) { event.preventDefault(); return; }
      submitting.current = true;
      onSubmit(event);
    }}>
      <input type="hidden" name="receipt_flow" value="parcel" />
      <fieldset disabled={saving} className="grid gap-3">
        <legend className="mb-3 text-sm font-semibold">1. Client</legend>
        <label className="grid gap-1.5 text-sm">Rechercher un client
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} className={field} placeholder="Nom ou téléphone" />
        </label>
        <label className="grid gap-1.5 text-sm">Client associé
          <select name="client_id" required className={field} value={selectedClient?.id || ""}
            onChange={event => setSelectedClient(choices.find(item => item.id === event.target.value) || null)}>
            <option value="">{clientLoading ? "Recherche…" : "Sélectionner un client"}</option>
            {choices.map(client => <option key={client.id} value={client.id}>
              {client.display_name || client.name || client.phone} · {client.phone || client.whatsapp_phone || "Sans téléphone"}
            </option>)}
          </select>
        </label>
        {!clientLoading && !clientError && !clients.length && <p className="text-xs text-[#68727d]">Aucun résultat pour cette recherche.</p>}
        {clientError && <p role="alert" className="text-sm text-red-700">{clientError} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Réessayer</button></p>}
        <PermissionGuard permission="clients.create"><InlineClientCreator onCreated={client => { setSelectedClient(client); setClientError(""); }} /></PermissionGuard>
      </fieldset>
      <fieldset disabled={saving || loading} className="grid gap-3">
        <legend className="mb-3 text-sm font-semibold">2. Transport</legend>
        {catalogError && <p role="alert" className="text-sm text-red-700">{catalogError} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Réessayer</button></p>}
        {!loading && !catalogError && !services.length && <p className="text-sm text-[#68727d]">Configurez un service et sa route dans Routes et Services avant de recevoir un colis.</p>}
        <label className="grid gap-1.5 text-sm">Service utilisé
          <select name="shipping_service_id" required className={field} value={serviceId} onChange={event => setServiceId(event.target.value)}>
            <option value="">{loading ? "Chargement…" : "Sélectionner un service"}</option>
            {services.map(item => <option key={item.id} value={item.id}>{item.service_name} · {routes.find(candidate => candidate.id === item.route_id)?.route_name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">Route
          <select name="route_id" required className={field} value={route?.id || ""} disabled={!route} onChange={() => undefined}>
            {!route && <option value="">Choisissez d’abord le service</option>}
            {route && <option value={route.id}>{route.route_name} · {route.origin_city || route.origin_country} → {route.destination_city || route.destination_country}</option>}
          </select>
        </label>
        <p className="text-xs text-[#68727d]">L’affectation à un départ se fera ensuite, dans une expédition compatible.</p>
      </fieldset>
      <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">3. Informations du colis</legend>
        <label className="grid gap-1.5 text-sm">Référence fournisseur (facultatif)<input name="supplier_tracking" maxLength={180} className={field} /></label>
        <label className="grid gap-1.5 text-sm">Poids en kg (si connu)<input name="weight_kg" type="number" min="0.001" step="0.001" className={field} placeholder="Non pesé" /></label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">Description (facultatif)<input name="description" maxLength={260} className={field} /></label>
      </fieldset>
      <fieldset disabled={saving} className="grid gap-3">
        <legend className="mb-3 text-sm font-semibold">4. Réception</legend>
        <p className="text-sm text-[#68727d]">État initial : reçu. Le bureau actif, la date et l’agent sont enregistrés automatiquement.</p>
        <label className="grid gap-1.5 text-sm">Emplacement de stockage (facultatif)<input name="warehouse_location" maxLength={160} className={field} placeholder="Ex. zone A, étagère B3" /></label>
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </form>
  </OperationDrawer>;
}
