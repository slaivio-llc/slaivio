"use client";
import { useEffect, useState } from "react";
import { getOfficeContext, type OfficeContext } from "@/services/organization-admin";
import { assignFinanceOffice } from "@/services/finance";

export function FinanceOfficeAssignment({documentId,version,onSaved}:{documentId:string;version:number;onSaved:()=>void|Promise<void>}) {
  const [context,setContext]=useState<OfficeContext|null>(null);
  const [office,setOffice]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;getOfficeContext().then(value=>{if(active)setContext(value);}).catch(()=>{if(active)setError("Impossible de charger les bureaux autorisés.");});return()=>{active=false;};},[]);
  async function save(){if(!office||busy)return;setBusy(true);setError("");try{await assignFinanceOffice(documentId,office,version);await onSaved();}catch{setError("Attribution impossible. Vérifiez vos droits et actualisez le document avant de réessayer.");}finally{setBusy(false);}}
  if(context&&(context.office_access_scope!=="ALL_OFFICES"||context.selected_office_id))return null;
  return <section className="space-y-2 rounded-md border p-3">
    <h3 className="text-sm font-semibold">Bureau responsable</h3>
    <p className="text-xs text-slate-500">Document non attribué. Choisissez le bureau responsable de cette facture, pas simplement la destination du colis. L’attribution sera conservée et auditée.</p>
    <label className="grid max-w-sm gap-1 text-sm">Bureau<select className="h-9 rounded-md border px-2" value={office} disabled={busy} onChange={event=>setOffice(event.target.value)}><option value="">Sélectionner un bureau</option>{context?.offices.map(value=><option key={value.location_id} value={value.location_id}>{value.name} · {value.city}</option>)}</select></label>
    <button disabled={!office||busy} onClick={save} className="h-9 rounded-md bg-emerald-700 px-3 text-sm text-white disabled:opacity-50">{busy?"Attribution…":"Confirmer l’attribution"}</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
