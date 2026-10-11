"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import axios from "axios";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import { api } from "@/services/api";
import { createPackage } from "@/services/packages";
import { getParcelOverview, type ParcelEntry, type ParcelOverview, type ParcelHistoryResult, type RegisterResult } from "@/services/parcel-register";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationButton, OperationFilterPopover } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { TableSkeleton } from "@/components/ui/page-state";
import { useResourceLink } from "@/components/ui/use-resource-link";
import { ParcelPackageCreateDrawer } from "./parcel-receipt-drawer";

const stages = [["received", "Reçus"], ["shipped", "Expédiés"], ["arrived", "Arrivés"], ["ready", "À retirer"], ["delivered", "Livrés"], ["other", "Autres états"]];
const linkClass = "font-medium text-emerald-800 hover:underline focus-visible:outline-emerald-600";

function Status({ item }: { item: ParcelEntry }) {
  const tone = item.stage === "delivered" ? "bg-emerald-50 text-emerald-800" : item.stage === "ready" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{item.status_label}</span>;
}
function ClientLink({ item }: { item: ParcelEntry }) {
  return item.client_id && item.local_client
    ? <PermissionGuard permission="clients.read" fallback={<span>{item.client_name || "Client"}</span>}><Link href={`/app/clients?open=${encodeURIComponent(item.client_id)}`} className={linkClass}>{item.client_name || "Client"}</Link></PermissionGuard>
    : <span>{item.client_name || "Client non renseigné"}</span>;
}
function formatDate(value: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Non renseignée";
}

export function ParcelRegisterPage() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [dates, setDates] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ParcelOverview | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const invalidDates = Boolean(dates.start && dates.end && dates.start > dates.end);
  const clearLink = useResourceLink(getParcelOverview, setSelected, setError);

  useEffect(() => {
    if (invalidDates) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      api.get<RegisterResult>("/packages/register", { params: { q: query, stage: stage || undefined, start: dates.start || undefined, end: dates.end || undefined, page }, signal: controller.signal })
        .then(response => { if (!controller.signal.aborted) setResult(response.data); })
        .catch(() => { if (!controller.signal.aborted) setError("Impossible de charger les colis."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, stage, dates, page, revision, invalidDates]);

  useEffect(() => {
    if (!opening) return;
    let active = true;
    setDetailError(false);
    getParcelOverview(opening).then(item => { if (active) { setSelected(item); setOpening(null); } })
      .catch(() => { if (active) setDetailError(true); });
    return () => { active = false; };
  }, [opening]);

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || "").trim();
    setSaving(true); setSaveError("");
    try {
      const created = await createPackage({ client_id: value("client_id"), shipping_service_id: value("shipping_service_id"), route_id: value("route_id"),
        supplier_tracking: value("supplier_tracking") || null, description: value("description") || null,
        weight_kg: value("weight_kg") ? Number(value("weight_kg")) : null, warehouse_location: value("warehouse_location") || null, source: "manual" });
      setCreateOpen(false); setPage(1); setRevision(value => value + 1); setOpening(created.id);
    } catch (cause) {
      const detail = axios.isAxiosError(cause) ? cause.response?.data?.detail : null;
      setSaveError(detail === "supplier_tracking_already_exists" ? "Cette référence fournisseur existe déjà. Vérifiez le colis existant ; votre saisie est conservée."
        : detail === "shipping_service_not_found_for_route" || detail === "route_not_found" ? "Le service ou la route n’est plus disponible. Vérifiez la configuration du bureau."
        : "Enregistrement impossible. Votre saisie est conservée ; vérifiez vos droits et la connexion.");
    } finally { setSaving(false); }
  }

  function reset() { setQuery(""); setStage(""); setDates({ start: "", end: "" }); setPage(1); }
  const filtered = Boolean(query || stage || dates.start || dates.end);
  return <div className="min-h-full bg-white">
    <OperationPageHeader title="Colis" description="De la réception à la remise au client." backHref="/app/operations" backLabel="Retour aux opérations"
      actions={<PermissionGuard permission="packages.create"><OperationButton variant="primary" onClick={() => { setSaveError(""); setCreateOpen(true); }}><Plus size={15} />Enregistrer un colis</OperationButton></PermissionGuard>} />
    <section aria-label="Registre des colis" className="mx-auto w-full max-w-[1200px] px-6 pb-8 sm:px-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <label className="relative mr-auto w-full sm:max-w-xs"><Search size={15} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
            <input type="search" aria-label="Rechercher un colis" placeholder="Référence, client ou téléphone…" maxLength={120} className={`${field} pl-9`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
          <OperationFilterPopover title="Filtrer les colis" activeCount={Number(Boolean(stage)) + Number(Boolean(dates.start || dates.end))} onReset={reset}>
            <label className="grid gap-1.5 text-xs font-medium">État<select className={field} value={stage} onChange={event => { setStage(event.target.value); setPage(1); }}><option value="">Tous les états</option>{stages.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-medium">Enregistré à partir du (UTC)<input type="date" className={field} value={dates.start} onChange={event => { setDates(value => ({ ...value, start: event.target.value })); setPage(1); }} /></label>
            <label className="grid gap-1.5 text-xs font-medium">Jusqu’au (UTC)<input type="date" className={field} value={dates.end} min={dates.start || undefined} onChange={event => { setDates(value => ({ ...value, end: event.target.value })); setPage(1); }} /></label>
          </OperationFilterPopover>
          <OperationButton className="w-9 px-0" aria-label="Actualiser les colis" title="Actualiser" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /></OperationButton>
        </div>
        {invalidDates ? <p role="alert" className="p-5 text-sm text-red-700">La date de fin doit suivre la date de début.</p>
          : error ? <div role="alert" className="p-5 text-sm">{error} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>Réessayer</button></div>
          : loading ? <TableSkeleton rows={6} columns={4} label="Chargement des colis" />
          : !result?.items.length ? <div className="px-5 py-16 text-center"><h2 className="text-sm font-semibold">{filtered ? "Aucun colis correspondant" : "Aucun colis enregistré"}</h2><p className="mt-2 text-sm text-slate-500">{filtered ? "Modifiez la recherche ou les filtres." : "Enregistrez votre première réception pour commencer."}</p>{filtered && <OperationButton className="mt-3" onClick={reset}>Effacer les filtres</OperationButton>}</div>
          : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Colis", "Client", "Service", "État"].map(label => <th key={label} scope="col" className="px-5 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{result.items.map(item => <tr key={item.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><button type="button" className={linkClass} onClick={() => setOpening(item.id)}>{item.reference || "Sans référence"}</button>{!item.local_client && <span className="mt-1 block text-xs text-slate-500">{item.office_name}</span>}</td><td className="px-5 py-4"><ClientLink item={item} /></td><td className="px-5 py-4 text-slate-600">{item.service_name || "Non renseigné"}</td><td className="whitespace-nowrap px-5 py-4"><Status item={item} /></td></tr>)}</tbody></table></div>
            <div className="flex items-center gap-2 px-5 py-4 text-xs text-slate-500"><span className="mr-auto">{(page-1)*50+1}–{Math.min(page*50,result.total)} sur {result.total}</span><OperationButton className="w-9 px-0" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage(value => value-1)}><ChevronLeft size={15} /></OperationButton><OperationButton className="w-9 px-0" aria-label="Page suivante" disabled={page >= result.total_pages} onClick={() => setPage(value => value+1)}><ChevronRight size={15} /></OperationButton></div></>}
      </div>
    </section>
    {createOpen && <ParcelPackageCreateDrawer warehouses={[]} saving={saving} error={saveError} onClose={() => setCreateOpen(false)} onSubmit={receive} />}
    {opening && <OperationDrawer open close={() => setOpening(null)} title="Colis" placement="right" width="max-w-2xl">{detailError ? <p role="alert" className="text-sm">Impossible d’ouvrir ce colis. Fermez la fiche et réessayez.</p> : <TableSkeleton rows={4} columns={2} label="Chargement du colis" />}</OperationDrawer>}
    {selected && <ParcelDetails key={selected.id} item={selected} close={() => { setSelected(null); clearLink(); }} />}
  </div>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1.5 break-words text-sm text-slate-800">{children || "Non renseigné"}</dd></div>;
}
function ParcelDetails({ item, close }: { item: ParcelOverview; close: () => void }) {
  const [tab, setTab] = useState("overview");
  const [history, setHistory] = useState<ParcelHistoryResult | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (tab !== "history") return;
    const controller = new AbortController(); setHistory(null); setError(false);
    api.get<ParcelHistoryResult>(`/packages/register/${item.id}/history`, { params: { page }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setHistory(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [tab, item.id, page, retry]);
  return <OperationDrawer open close={close} placement="right" width="max-w-2xl" title={item.reference || "Colis"} headerMeta={<Status item={item} />}
    tabs={<div className="flex gap-5">{[["overview", "Vue d’ensemble"], ["history", "Historique"]].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`border-b-2 py-3 text-sm font-medium ${tab === key ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>}>
    {tab === "overview" ? <div className="grid gap-8"><section><h3 className="mb-4 text-sm font-semibold">Colis et client</h3><dl className="grid gap-5 sm:grid-cols-2"><Fact label="Client"><ClientLink item={item} /></Fact><Fact label="Référence fournisseur">{item.supplier_tracking || item.external_reference}</Fact><Fact label="Poids">{item.weight_kg == null ? "Non pesé" : `${new Intl.NumberFormat("fr").format(item.weight_kg)} kg`}</Fact><Fact label="Description">{item.description}</Fact></dl></section>
      <section><h3 className="mb-4 text-sm font-semibold">Transport</h3><dl className="grid gap-5 sm:grid-cols-2"><Fact label="Service">{item.service_name}</Fact><Fact label="Route">{item.route_name}</Fact><Fact label="Destination">{[item.destination_city,item.destination_country].filter(Boolean).join(", ")}</Fact><Fact label="Expédition">{item.shipment_id ? <PermissionGuard permission="shipments.read" fallback={<span>{item.shipment_reference || "Affecté"}</span>}><Link className={linkClass} href={`/app/shipments/${encodeURIComponent(item.shipment_id)}`}>{item.shipment_reference || "Voir l’expédition"}</Link></PermissionGuard> : "Pas encore affecté"}</Fact></dl></section>
      <section><h3 className="mb-4 text-sm font-semibold">Réception</h3><dl className="grid gap-5 sm:grid-cols-2"><Fact label="Bureau de réception">{item.office_name}</Fact><Fact label="Date de réception">{formatDate(item.received_at)}</Fact><Fact label="Emplacement">{[item.warehouse_zone,item.warehouse_rack,item.warehouse_location].filter(Boolean).join(" · ")}</Fact></dl></section></div>
      : error ? <p role="alert" className="text-sm">Historique indisponible. <button type="button" className="underline" onClick={() => setRetry(value => value+1)}>Réessayer</button></p>
      : !history ? <TableSkeleton rows={4} columns={1} label="Chargement de l’historique" />
      : <><ol className="space-y-6">{history.items.map(event => <li key={event.id} className="border-l-2 border-slate-200 pl-4"><p className="text-sm font-medium">{event.title}</p><time className="mt-1 block text-xs text-slate-500" dateTime={event.created_at}>{formatDate(event.created_at)}</time>{event.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>}</li>)}</ol>{!history.items.length && <p className="text-sm text-slate-500">Aucun événement enregistré.</p>}<div className="mt-6 flex justify-end gap-2"><OperationButton disabled={page === 1} onClick={() => setPage(value => value-1)}>Précédent</OperationButton><OperationButton disabled={page >= history.total_pages} onClick={() => setPage(value => value+1)}>Suivant</OperationButton></div></>}
  </OperationDrawer>;
}
