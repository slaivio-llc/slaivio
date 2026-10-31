"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import { useEffect, useState } from "react";
import { getOfficeContext, type OfficeContext } from "@/services/organization-admin";
import { assignFinanceOffice } from "@/services/finance";

export function FinanceOfficeAssignment({documentId,version,onSaved}:{documentId:string;version:number;onSaved:()=>void|Promise<void>}) {
  useDashboardMessages();
  const [context,setContext]=useState<OfficeContext|null>(null);
  const [office,setOffice]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;getOfficeContext().then(value=>{if(active){setContext(value);setOffice(value.selected_office_id|| (value.offices.length===1?value.offices[0].location_id:""));}}).catch(()=>{if(active)setError("Impossible de charger les bureaux autorisés.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  async function save(){if(!office||busy)return;setBusy(true);setError("");try{await assignFinanceOffice(documentId,office,version);await onSaved();}catch{setError("Attribution impossible. Vérifiez vos droits et actualisez le document avant de réessayer.");}finally{setBusy(false);}}
  return <section className="space-y-3 rounded-lg bg-slate-50 p-4">
    <h3 className="text-sm font-semibold">{dashboardText("Bureau responsable")}</h3>
    <p className="text-xs text-slate-600">{dashboardText("Cette facture n’est pas encore rattachée à un bureau. Choisissez parmi les bureaux auxquels votre compte a accès.")}</p>
    {loading?<p className="text-sm text-slate-500">{dashboardText("Chargement des bureaux…")}</p>:context?.offices.length?<>
      <label className="grid max-w-sm gap-1 text-sm">{dashboardText("Bureau")}<select aria-label={dashboardText("Bureau responsable")} className="h-9 rounded-md bg-white px-2" value={office} disabled={busy} onChange={event=>setOffice(event.target.value)}><option value="">{dashboardText("Sélectionner un bureau")}</option>{context.offices.map(value=><option key={value.location_id} value={value.location_id}>{value.name} · {value.city}</option>)}</select></label>
      <button disabled={!office||busy} onClick={save} className="h-9 rounded-md bg-emerald-700 px-3 text-sm text-white disabled:opacity-50">{busy?dashboardText("Attribution…"):dashboardText("Confirmer l’attribution")}</button>
    </>:<p className="text-sm text-amber-800">{dashboardText("Aucun bureau actif ne vous est accessible. Demandez à un administrateur de vérifier les bureaux et vos autorisations.")}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{dashboardText(error)}</p>}
  </section>;
}
