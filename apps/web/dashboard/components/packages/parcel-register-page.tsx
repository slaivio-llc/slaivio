"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import axios from "axios";
import { ChevronLeft, ChevronRight, Plus, Search, PackageCheck } from "lucide-react";
import { api, apiErrorDetail } from "@/services/api";
import { createPackage, getPackage, getPackageLabel, getPackageStats, type PackageRecord, type PackageStats } from "@/services/packages";
import { getParcelOverview, type ParcelEntry, type ParcelOverview, type ParcelHistoryResult, type RegisterResult } from "@/services/parcel-register";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationButton, OperationFilterPopover } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { TableSkeleton } from "@/components/ui/page-state";
import { businessHistoryTitle } from "@/components/ui/business-labels";
import { useResourceLink } from "@/components/ui/use-resource-link";
import { ParcelPackageCreateDrawer } from "./parcel-receipt-drawer";
import { ParcelEditForm, ParcelPhotos, parcelError } from "./parcel-operations";
import { PackageFinance } from "@/components/finance/package-finance";
import {receptionPhotos,uploadReceptionPhotos,ReceptionPhotoValidationError} from '@/services/reception-photos';

const stages = [["received", "Reçus"], ["shipped", "Expédiés"], ["arrived", "Arrivés"], ["ready", "À retirer"], ["delivered", "Livrés"], ["other", "Autres états"]];
const linkClass = "font-medium text-emerald-800 hover:underline focus-visible:outline-emerald-600";

function Status({ item }: { item: ParcelEntry }) {
  useDashboardMessages();
  const tone = item.stage === "delivered" ? "bg-emerald-50 text-emerald-800" : item.stage === "ready" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{item.status_label}</span>;
}
function ClientLink({ item }: { item: ParcelEntry }) {
  useDashboardMessages();
  return item.client_id && item.local_client
    ? <PermissionGuard permission="clients.read" fallback={<span>{item.client_name || dashboardText("Client")}</span>}><Link href={`/app/clients?open=${encodeURIComponent(item.client_id)}`} className={linkClass}>{item.client_name || dashboardText("Client")}</Link></PermissionGuard>
    : <span>{item.client_name || dashboardText("Client non renseigné")}</span>;
}
function formatDate(value: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Non renseignée";
}

export function ParcelRegisterPage({ embedded = false, createRequest = 0 }: { embedded?: boolean; createRequest?: number }) {
  useDashboardMessages();
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
  const [notice,setNotice]=useState('');
  const [stats, setStats] = useState<PackageStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const invalidDates = Boolean(dates.start && dates.end && dates.start > dates.end);
  const clearLink = useResourceLink(getParcelOverview, setSelected, setError);

  useEffect(() => {
    if (!createRequest) return;
    setSaveError("");
    setCreateOpen(true);
  }, [createRequest]);

  useEffect(() => {
    if (!embedded) return;
    let active = true;
    getPackageStats().then(value => { if (active) { setStats(value); setStatsError(false); } })
      .catch(() => { if (active) setStatsError(true); });
    return () => { active = false; };
  }, [embedded, revision]);

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
      const physicalReceived = form.get("physical_received") === "on";
      const photos=receptionPhotos(form);
      const created = await createPackage({ client_id: value("client_id"), shipping_service_id: value("shipping_service_id"), route_id: value("route_id"),
        supplier_tracking: value("supplier_tracking") || null, description: value("description") || null,
        category:value('category') || null,goods_classification:value('goods_classification') || 'ORDINARY_GOODS',package_type:(value('package_type') || 'carton') as PackageRecord['package_type'],
        volume_cbm:value('volume_cbm') ? Number(value('volume_cbm')) : null,
        weight_kg: value("weight_kg") ? Number(value("weight_kg")) : null, pieces_count: Number(value("pieces_count") || "1"),
        warehouse_location: value("warehouse_location") || null, status: physicalReceived ? "RECEIVED_AT_ORIGIN" : "CREATED",
        received_at: physicalReceived ? new Date().toISOString() : null, source: "manual" });
      const failed=await uploadReceptionPhotos(created.id,photos,form.get('share_reception_photos')==='on');
      setNotice(failed.length?`Le colis est enregistré. Photos à vérifier dans sa fiche : ${failed.join(', ')}. Ne recréez pas le colis ; un envoi interrompu peut avoir réussi.`:'');
      setCreateOpen(false); setPage(1); setRevision(value => value + 1); setOpening(created.id);
    } catch (cause) {
      if(cause instanceof ReceptionPhotoValidationError){setSaveError(cause.message);return;}
      const detail = axios.isAxiosError(cause) ? cause.response?.data?.detail : null;
      if(detail?.code==='plan_limit_reached'){setSaveError(apiErrorDetail(cause));return;}
      setSaveError(detail === "supplier_tracking_already_exists" ? "Cette référence fournisseur existe déjà. Vérifiez le colis existant ; votre saisie est conservée."
        : detail === "shipping_service_not_found_for_route" || detail === "route_not_found" ? "Le service ou la route n’est plus disponible. Vérifiez la configuration du bureau."
          : ['package_category_required','package_packaging_required','package_measurement_required','goods_not_accepted','regulated_goods_review_required'].includes(detail) ? parcelError(cause)
          : "Enregistrement impossible. Votre saisie est conservée ; vérifiez vos droits et la connexion.");
    } finally { setSaving(false); }
  }

  function reset() { setQuery(""); setStage(""); setDates({ start: "", end: "" }); setPage(1); }
  const filtered = Boolean(query || stage || dates.start || dates.end);
  return <div className={`min-h-full bg-white ${embedded ? "py-2" : ""}`}>
    {notice&&<p role="status" className="mx-4 my-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{dashboardText(notice)}</p>}
    {!embedded && <OperationPageHeader title={dashboardText("Colis")} description={dashboardText("De la réception à la remise au client.")} backHref="/app/operations" backLabel="Retour aux opérations"
      actions={<PermissionGuard permission="packages.create"><OperationButton variant="primary" onClick={() => { setSaveError(""); setCreateOpen(true); }}><Plus size={15} />{dashboardText("Enregistrer un colis")}</OperationButton></PermissionGuard>} />}
    <section aria-label={dashboardText("Registre des colis")} className={`mx-auto w-full pb-8 ${embedded ? "max-w-full px-0" : "max-w-[1200px] px-6 sm:px-8"}`}>
      <div>
        {embedded && <div className="grid grid-cols-4 gap-2 py-3" aria-label={dashboardText("Indicateurs colis")}>
          {[[dashboardText("Total"), stats?.total], [dashboardText("Reçus"), stats?.received], [dashboardText("Expédiés"), stats?.in_transit], [dashboardText("Arrivés"), stats?.arrived]].map(([label, value]) => <div key={String(label)} className="min-w-0"><span className="block truncate text-[10px] text-slate-500">{dashboardText(label)}</span><strong className="mt-1 block text-sm font-semibold text-slate-900">{statsError ? "—" : value ?? "—"}</strong></div>)}
        </div>}
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? "py-2" : "p-4"}`}>
          <label className={`relative ${embedded ? "w-full sm:flex-1" : "mr-auto w-full sm:max-w-xs"}`}><Search size={15} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
            <input type="search" aria-label={dashboardText("Rechercher un colis")} placeholder={embedded ? dashboardText("Rechercher un colis ou un client…") : dashboardText("Référence, client ou téléphone…")} maxLength={120} className={`${field} pl-9`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
          {!embedded && <>
          <OperationFilterPopover title={dashboardText("Filtrer les colis")} activeCount={Number(Boolean(stage)) + Number(Boolean(dates.start || dates.end))} onReset={reset}>
            <label className="grid gap-1.5 text-xs font-medium">{dashboardText("État")}<select className={field} value={stage} onChange={event => { setStage(event.target.value); setPage(1); }}><option value="">{dashboardText("Tous les états")}</option>{stages.map(([key, label]) => <option key={key} value={key}>{dashboardText(label)}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-medium">{dashboardText("Enregistré à partir du (UTC)")}<input type="date" className={field} value={dates.start} onChange={event => { setDates(value => ({ ...value, start: event.target.value })); setPage(1); }} /></label>
            <label className="grid gap-1.5 text-xs font-medium">{dashboardText("Jusqu’au (UTC)")}<input type="date" className={field} value={dates.end} min={dates.start || undefined} onChange={event => { setDates(value => ({ ...value, end: event.target.value })); setPage(1); }} /></label>
          </OperationFilterPopover>
          </>}
        </div>
        {embedded && <nav aria-label={dashboardText("Filtrer les colis par statut")} className="flex flex-wrap gap-1 px-3 py-2">{[["", dashboardText("Tous")], ["received", dashboardText("Reçus")], ["shipped", dashboardText("Expédiés")], ["arrived", dashboardText("Arrivés")], ["delivered", dashboardText("Livrés")]].map(([key, label]) => <button key={key} type="button" aria-pressed={stage === key} onClick={() => { setStage(key); setPage(1); }} className={`rounded-full px-2.5 py-1 text-[11px] ${stage === key ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}>{dashboardText(label)}</button>)}</nav>}
        {invalidDates ? <p role="alert" className="p-5 text-sm text-red-700">{dashboardText("La date de fin doit suivre la date de début.")}</p>
          : error ? <div role="alert" className="p-5 text-sm">{dashboardText(error)} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>{dashboardText("Réessayer")}</button></div>
          : loading ? <TableSkeleton rows={6} columns={4} label={dashboardText("Chargement des colis")} />
          : !result?.items.length ? <div className="px-5 py-16 text-center"><h2 className="text-sm font-semibold">{filtered ? dashboardText("Aucun colis correspondant") : dashboardText("Aucun colis enregistré")}</h2><p className="mt-2 text-sm text-slate-500">{filtered ? dashboardText("Modifiez la recherche ou les filtres.") : dashboardText("Enregistrez votre première réception pour commencer.")}</p>{filtered && <OperationButton className="mt-3" onClick={reset}>{dashboardText("Effacer les filtres")}</OperationButton>}</div>
          : <><div className={embedded ? "divide-y divide-slate-100 px-2" : "overflow-x-auto"}>{embedded ? result.items.map(item => <button key={item.id} type="button" onClick={() => setOpening(item.id)} className="flex w-full items-center gap-3 px-2 py-4 text-left hover:bg-slate-50"><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-900">{item.reference || dashboardText("Sans référence")}</span><span className="mt-1 block truncate text-[10px] text-slate-600">{item.client_name || dashboardText("Client non renseigné")}{item.service_name ? ` · ${item.service_name}` : ""}</span>{!item.local_client && <span className="mt-1 block truncate text-[10px] text-slate-500">{item.office_name}</span>}</span><Status item={item}/><ChevronRight size={14} className="shrink-0 text-slate-400"/></button>) : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{[dashboardText("Colis"), dashboardText("Client"), dashboardText("Service"), dashboardText("État")].map(label => <th key={label} scope="col" className="px-5 py-3 font-medium">{dashboardText(label)}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{result.items.map(item => <tr key={item.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><button type="button" className={linkClass} onClick={() => setOpening(item.id)}>{item.reference || dashboardText("Sans référence")}</button>{!item.local_client && <span className="mt-1 block text-xs text-slate-500">{item.office_name}</span>}</td><td className="px-5 py-4"><ClientLink item={item} /></td><td className="px-5 py-4 text-slate-600">{item.service_name || dashboardText("Non renseigné")}</td><td className="whitespace-nowrap px-5 py-4"><Status item={item} /></td></tr>)}</tbody></table>}</div>
            <div className="flex items-center gap-2 px-5 py-4 text-xs text-slate-500"><span className="mr-auto">{(page-1)*50+1}–{Math.min(page*50,result.total)} {dashboardText(" sur ")}{result.total}</span><OperationButton className="w-9 px-0" aria-label={dashboardText("Page précédente")} disabled={page === 1} onClick={() => setPage(value => value-1)}><ChevronLeft size={15} /></OperationButton><OperationButton className="w-9 px-0" aria-label={dashboardText("Page suivante")} disabled={page >= result.total_pages} onClick={() => setPage(value => value+1)}><ChevronRight size={15} /></OperationButton></div></>}
      </div>
    </section>
    {createOpen && <ParcelPackageCreateDrawer warehouses={[]} saving={saving} error={saveError} onClose={() => setCreateOpen(false)} onSubmit={receive} />}
    {opening && <OperationDrawer open close={() => setOpening(null)} title={dashboardText("Colis")} placement="center" width="max-w-[650px]" variant="detail" panelClassName="min-h-[min(680px,calc(100dvh-48px))]">{detailError ? <p role="alert" className="text-sm">{dashboardText("Impossible d’ouvrir ce colis. Fermez la fiche et réessayez.")}</p> : <TableSkeleton rows={4} columns={2} label={dashboardText("Chargement du colis")} />}</OperationDrawer>}
    {selected && <ParcelDetails key={selected.id} item={selected} changed={updated=>{setSelected(updated);setRevision(value=>value+1);}} close={() => { setSelected(null); clearLink(); }} />}
  </div>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  useDashboardMessages();
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{dashboardText(label)}</dt><dd className="mt-1.5 break-words text-sm text-slate-800">{children || dashboardText("Non renseigné")}</dd></div>;
}
function ParcelDetails({ item, close, changed }: { item: ParcelOverview; close: () => void; changed: (item: ParcelOverview) => void }) {
  useDashboardMessages();
  const [editing,setEditing]=useState(false);
  const [confirmReady,setConfirmReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [mutationError,setMutationError]=useState("");
  const [notice,setNotice]=useState("");
  async function printLabel(){
    const popup=window.open('','_blank','width=650,height=800');
    if(!popup){setNotice('Autorisez les fenêtres contextuelles pour imprimer l’étiquette.');return;}
    try{const content=await getPackageLabel(item.id,'print');popup.document.write(await content.text());popup.document.close();popup.focus();popup.print();}
    catch{popup.close();setNotice('Impossible de préparer l’étiquette. Réessayez.');}
  }
  const pending=useRef(false);
  async function refresh() {
    try { changed(await getParcelOverview(item.id)); }
    catch { setNotice("Opération enregistrée, mais la fiche n’a pas pu être actualisée. Fermez puis rouvrez-la."); }
  }
  async function command(action:"edit"|"ready",changes?:Record<string,unknown>,reason?:string) {
    if(pending.current||busy)return;
    pending.current=true;setBusy(true);setMutationError("");setNotice("");
    let committed=false;
    try {
      if(action==="edit")await api.patch(`/packages/register/${item.id}`,{...changes,reason,expected_version:item.row_version});
      else await api.post(`/packages/register/${item.id}/ready`,{expected_version:item.row_version});
      committed=true;setEditing(false);setConfirmReady(false);await refresh();
    } catch(cause) {setMutationError(committed?"Opération enregistrée. Actualisez la fiche.":parcelError(cause));}
    finally{pending.current=false;setBusy(false);}
  }
  const [history, setHistory] = useState<ParcelHistoryResult | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController(); setHistory(null); setHistoryError(false);
    api.get<ParcelHistoryResult>(`/packages/register/${item.id}/history`, { params: { page: historyPage }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setHistory({...response.data,items:response.data.items.map(event=>({...event,title:businessHistoryTitle(event.title)}))}); })
      .catch(() => { if (!controller.signal.aborted) setHistoryError(true); });
    return () => controller.abort();
  }, [item.id, item.row_version, historyPage]);
  return <OperationDrawer open close={()=>{if(!busy)close();}} placement="center" width="max-w-[650px]" panelClassName="min-h-[min(680px,calc(100dvh-48px))]" title={item.reference || dashboardText("Colis")} headerMeta={<Status item={item} />} headerActions={!editing&&item.stage!=="delivered"&&!["CANCELLED","RETURNED"].includes(item.status)?<PermissionGuard permission="packages.update"><OperationButton aria-label={dashboardText("Modifier le colis")} title={dashboardText("Modifier")} disabled={busy} onClick={()=>{setEditing(true);setConfirmReady(false);setMutationError("");}}>{dashboardText("Modifier")}</OperationButton></PermissionGuard>:undefined}>
    {notice&&<p role="status" className="mb-4 text-sm text-emerald-800">{dashboardText(notice)}</p>}
    {editing?<ParcelEditForm item={item} saving={busy} error={mutationError} cancel={()=>setEditing(false)} save={(changes,reason)=>void command("edit",changes,reason)}/>:
      <div className="divide-y divide-slate-200">
        <section className="pb-5"><p className="mb-3 text-[11px] text-slate-500">{dashboardText("Opérations / Colis")}</p><h3 className="mb-3 text-sm font-semibold">{dashboardText("Informations du colis")}</h3><dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2"><Fact label={dashboardText("Client")}><ClientLink item={item}/></Fact><Fact label={dashboardText("Service")}>{item.service_name}</Fact><Fact label={dashboardText("Route")}>{item.route_name||[item.destination_city,item.destination_country].filter(Boolean).join(", ")}</Fact><Fact label={dashboardText("Poids")}>{item.weight_kg==null?dashboardText("Non pesé"):dashboardText("{0} kg", new Intl.NumberFormat("fr").format(item.weight_kg))}</Fact><Fact label={dashboardText("Référence fournisseur")}>{item.supplier_tracking||item.external_reference}</Fact><Fact label={dashboardText("Stockage")}>{[item.warehouse_zone,item.warehouse_rack,item.warehouse_location].filter(Boolean).join(" · ")||item.office_name}</Fact><Fact label={dashboardText("Expédition")}>{item.shipment_id?<PermissionGuard permission="shipments.read" fallback={<span>{item.shipment_reference||dashboardText("Affecté")}</span>}><Link className={linkClass} href={`/app/shipments/${encodeURIComponent(item.shipment_id)}`}>{item.shipment_reference||dashboardText("Voir l’expédition")}</Link></PermissionGuard>:dashboardText("Pas encore affecté")}</Fact>{item.description&&<Fact label={dashboardText("Description")}>{item.description}</Fact>}</dl></section>
        <section className="py-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">{dashboardText("Suivi du colis")}</h3><button type="button" className="text-xs font-medium text-slate-600 underline underline-offset-2" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(value=>!value)}>{historyOpen?dashboardText("Masquer l’historique"):dashboardText("Historique complet")}</button></div>{history?<ParcelMilestones item={item} history={history}/>:historyError?<p role="alert" className="text-sm text-amber-800">{dashboardText("Événements de suivi indisponibles. Le statut courant reste affiché dans l’en-tête.")}</p>:<TableSkeleton rows={1} columns={4} label={dashboardText("Chargement du suivi")}/>}{historyOpen&&<div className="mt-4 border-t border-slate-100 pt-3">{history?.items.length?<><ol className="space-y-3">{history.items.map(event=><li key={event.id} className="flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{event.title}</span><time className="shrink-0 text-slate-500">{formatDate(event.created_at)}</time></li>)}</ol>{history.total_pages>1&&<div className="mt-3 flex items-center justify-end gap-2"><OperationButton disabled={historyPage<=1} onClick={()=>setHistoryPage(value=>value-1)}>{dashboardText("Précédent")}</OperationButton><span className="text-xs text-slate-500">{history.page}/{history.total_pages}</span><OperationButton disabled={historyPage>=history.total_pages} onClick={()=>setHistoryPage(value=>value+1)}>{dashboardText("Suivant")}</OperationButton></div>}</>:<p className="text-xs text-slate-500">{historyError?dashboardText("Historique indisponible."):history?dashboardText("Aucun événement enregistré."):dashboardText("Chargement de l’historique…")}</p>}</div>}</section>
        {item.stage==="arrived"&&<PermissionGuard permission="packages.update"><section className="py-4">{confirmReady?<><h3 className="text-sm font-semibold">{dashboardText("Confirmer la disponibilité")}</h3><p className="mt-2 text-sm text-slate-600">{dashboardText("Le colis est physiquement disponible au point de retrait. Le client sera averti si les notifications sont activées.")}</p><div className="mt-4 flex justify-end gap-2"><OperationButton disabled={busy} onClick={()=>setConfirmReady(false)}>{dashboardText("Annuler")}</OperationButton><OperationButton variant="primary" disabled={busy} onClick={()=>void command("ready")}>{busy?dashboardText("Confirmation…"):dashboardText("Confirmer")}</OperationButton></div></>:<OperationButton disabled={busy} onClick={()=>{setMutationError("");setConfirmReady(true);}}><PackageCheck size={15}/>{dashboardText("Disponible pour retrait")}</OperationButton>}{mutationError&&<p role="alert" className="mt-3 text-sm text-red-700">{mutationError}</p>}</section></PermissionGuard>}
        <section className="py-5"><OperationButton onClick={()=>void printLabel()}>{dashboardText("Imprimer l’étiquette")}</OperationButton></section>
        <section className="py-5"><ParcelPhotos item={item} changed={refresh} busyChanged={setBusy} disabled={busy}/></section>
        <section className="py-5"><PermissionGuard permission="finance.read" fallback={<p role="status" className="text-sm text-slate-600">{dashboardText("Vous n’avez pas l’autorisation de consulter Finance pour ce colis.")}</p>}><ParcelFinanceDetails item={item} changed={refresh}/></PermissionGuard></section>
      </div>}
  </OperationDrawer>;
}

function ParcelMilestones({item,history}:{item:ParcelOverview;history:ParcelHistoryResult}) {
  useDashboardMessages();
  const states={received:["RECEIVED","RECEIVED_AT_ORIGIN","WAREHOUSED","WAREHOUSE_PROCESSING","READY_FOR_DISPATCH","READY_FOR_BATCH","BATCHED"],shipped:["SHIPPED","IN_TRANSIT","CUSTOMS"],arrived:["ARRIVED","ARRIVED_DESTINATION","CLEARED","READY_FOR_PICKUP"],delivered:["DELIVERED"]};
  const current=item.stage==="ready"?"arrived":item.stage;
  const steps=[{key:"received",label:"Reçu",date:item.received_at},{key:"shipped",label:"Expédié",date:item.dispatched_at},{key:"arrived",label:"Arrivé",date:history.items.find(event=>states.arrived.includes(event.new_status||""))?.created_at||null},{key:"delivered",label:"Livré",date:item.delivered_at}];
  return <ol aria-label={dashboardText("Étapes du colis")} className="grid grid-cols-4">{steps.map((step,index)=>{const event=history.items.find(row=>states[step.key as keyof typeof states].includes(row.new_status||""));const date=step.date||event?.created_at;const reached=Boolean(date)||steps.findIndex(row=>row.key===current)>index;const active=step.key===current;return <li key={step.key} className="relative flex min-w-0 flex-col items-center text-center">{index>0&&<span aria-hidden="true" className={`absolute right-1/2 top-2.5 h-px w-full ${reached?"bg-emerald-600":"bg-slate-200"}`}/>}<span className={`relative z-10 grid h-5 w-5 place-items-center rounded-full text-[10px] ${reached||active?"bg-emerald-700 text-white":"bg-slate-200 text-slate-500"}`}>{reached?"✓":"•"}</span><span className="mt-1.5 text-[10px] font-medium text-slate-700">{dashboardText(step.label)}</span><span className="text-[9px] text-slate-500">{date?new Intl.DateTimeFormat("fr",{day:"numeric",month:"short"}).format(new Date(date)):active?dashboardText("En cours"):"—"}</span></li>;})}</ol>;
}

function ParcelFinanceDetails({item,changed}:{item:ParcelOverview;changed:()=>Promise<void>}) {
  useDashboardMessages();
  const [record,setRecord]=useState<PackageRecord|null>(null);const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;getPackage(item.id).then(value=>{if(active)setRecord(value)}).catch(()=>{if(active)setError(true)});return()=>{active=false};},[item.id,retry]);
  return <>{error?<p role="alert" className="text-sm">{dashboardText("Situation de paiement indisponible. ")}<button className="underline" onClick={()=>{setError(false);setRetry(value=>value+1)}}>{dashboardText("Réessayer")}</button></p>:!record?<TableSkeleton rows={2} columns={3} label={dashboardText("Chargement du paiement")}/>:<PackageFinance item={record} onUpdated={async updated=>{setRecord(updated);await changed();}}/>}</>;
}
