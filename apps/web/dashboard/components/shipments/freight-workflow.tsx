"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Ban, CalendarClock, Download, PackageMinus, PackagePlus, Plane, PlaneLanding, Printer, TriangleAlert } from "lucide-react";
import { createPortal } from "react-dom";
import { api } from "@/services/api";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { PermissionGuard } from "@/components/permissions/permission-guard";

type Shipment = {id:string;reference:string;version:number;workflow_version?:number;stage:string;status?:string;packages_count:number;is_delayed?:boolean;route_label?:string|null};
type Candidate = {id:string;reference:string;client_name:string|null;blockers:string[];weight_kg?:number|null};
type Candidates = {items:Candidate[];page:number;total_pages:number};
const reasons:Record<string,string>={parcel_not_received:"Réception physique requise",client_missing:"Client manquant",route_mismatch:"Route incompatible",service_mismatch:"Le service du colis ne correspond pas à celui de l’expédition.",destination_mismatch:"Destination incompatible",already_assigned:"Déjà affecté",payment_clearance_required:"Paiement à vérifier avant le départ",PAYMENT_CLEARANCE_REQUIRED:"Paiement à vérifier avant le départ",FINANCE_POLICY_MISSING:"Aucune condition financière avant départ n’est configurée. Ajoutez une règle dans Finance > Paramètres.",FINANCE_INVOICE_MISSING:"Ce colis n’a pas de facture Finance émise. Créez ou émettez sa facture avant de confirmer le départ.",FINANCE_POLICY_CURRENCY_MISMATCH:"La devise de la condition de paiement ne correspond pas à celle de la facture.",package_state_conflict:"État du colis incompatible",shipment_empty:"Aucun colis affecté",shipment_loading_closed:"Le chargement est clôturé",shipment_departure_not_confirmed:"L’expédition ne possède pas de départ réel confirmé.",stale_shipment_version:"La fiche a changé. Fermez le panneau et actualisez avant de reprendre.",legacy_shipment_requires_review:"Cette ancienne expédition nécessite une reprise contrôlée."};
function failure(cause:unknown){
  if(!axios.isAxiosError(cause)||!cause.response)return "Le serveur n’a pas confirmé le départ. Actualisez la fiche pour vérifier son état avant toute nouvelle tentative.";
  const detail=cause.response.data?.detail;
  const code=typeof detail==="string"?detail:detail?.code;
  const financeMessage=typeof detail==="object"&&detail?.finance?.message;
  if(code==="FINANCE_POLICY_MISSING"&&financeMessage)return financeMessage;
  if(code==="package_not_eligible")return `Colis ${detail.reference||"incompatible"} : ${(detail.reasons as string[]).map(key=>reasons[key]||key).join(", ")}. Aucune modification effectuée.`;
  if(code==="PAYMENT_CLEARANCE_REQUIRED"){
    const finance=detail.finance||{};
    return `Départ bloqué pour ${detail.reference||finance.reference||"un colis"}. ${finance.message||"Le montant exigible avant départ n’est pas couvert par les paiements confirmés."}`;
  }
  if(financeMessage)return `${reasons[code]||"Départ bloqué"}${detail.reference?` · ${detail.reference}`:""}. ${financeMessage}`;
  if(typeof detail==="string"&&reasons[detail])return reasons[detail];
  if(typeof code==="string"&&reasons[code])return `${reasons[code]}${detail?.reference?` · ${detail.reference}`:""}`;
  if(typeof detail==="object"&&typeof detail?.message==="string")return detail.message;
  if(cause.response.status===409)return "Le départ est en conflit avec l’état actuel de l’expédition. Actualisez la fiche, puis corrigez le motif indiqué par le serveur.";
  return `Le départ a été refusé par le serveur (${cause.response.status}). Vérifiez la fiche et réessayez si le motif a été corrigé.`;
}

reasons.quality_review_required="Contrôle qualité bloquant à résoudre";

export function FreightWorkflow({item,saved,onPlan=()=>undefined,onCancel=()=>undefined,onManifest=()=>undefined,compact=false}:{item:Shipment;saved:()=>void;onPlan?:()=>void;onCancel?:()=>void;onManifest?:()=>void;compact?:boolean}){
  const [action,setAction]=useState<"load"|"remove"|"depart"|"arrive"|"delay"|null>(null);
  if(item.workflow_version!==2)return <p className="mb-5 text-xs text-amber-800">Expédition historique : consultation disponible. Sa reprise doit être vérifiée avant d’utiliser les nouvelles commandes.</p>;
  if(item.stage==="other")return item.status==="CANCELLED"?<span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Expédition annulée</span>:null;
  if(compact)return <div className="flex flex-wrap items-center gap-2" aria-label="Actions disponibles">
    {item.stage==="planned"&&<PermissionGuard permission="shipments.update"><OperationButton onClick={()=>setAction("load")}><PackagePlus size={14}/>Ajouter</OperationButton></PermissionGuard>}
    {item.stage==="planned"&&<PermissionGuard permission="shipments.update"><OperationButton variant="primary" disabled={!item.packages_count} onClick={()=>setAction("depart")}><Plane size={14}/>Confirmer départ</OperationButton></PermissionGuard>}
    {item.stage==="departed"&&<PermissionGuard permission="shipments.update"><OperationButton variant="primary" onClick={()=>setAction("arrive")}><PlaneLanding size={14}/>Confirmer arrivée</OperationButton></PermissionGuard>}
    <details className="relative"><summary aria-label="Autres actions" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md border border-slate-200 text-lg text-slate-700 hover:bg-slate-50">…</summary><div className="absolute right-0 top-full z-20 mt-1 grid min-w-52 gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
      {item.stage==="planned"&&<PermissionGuard permission="shipments.update"><><button type="button" className="rounded px-3 py-2 text-left text-xs hover:bg-slate-50" onClick={onPlan}>Modifier le départ prévu</button>{!!item.packages_count&&<button type="button" className="rounded px-3 py-2 text-left text-xs hover:bg-slate-50" onClick={()=>setAction("remove")}>Retirer des colis</button>}<button type="button" className="rounded px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50" onClick={onCancel}>Annuler l’expédition</button></></PermissionGuard>}
      {item.stage==="departed"&&<PermissionGuard permission="shipments.update"><button type="button" className="rounded px-3 py-2 text-left text-xs hover:bg-slate-50" onClick={()=>setAction("delay")}>{item.is_delayed?"Résoudre le retard":"Signaler un retard"}</button></PermissionGuard>}
      {item.stage==="arrived"&&<span className="px-3 py-2 text-xs text-slate-500">Aucune autre action disponible</span>}
    </div></details>
    {action==="load"?<Loading item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action==="remove"?<Unloading item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action==="delay"?<Delay item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action&&<Milestone item={item} action={action} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>}
  </div>;
  return <div className="flex flex-wrap items-center gap-2" aria-label="Actions disponibles">
    {item.stage==="planned"&&<PermissionGuard permission="shipments.update"><>
      <OperationButton onClick={onPlan}><CalendarClock size={14}/>Modifier le départ prévu</OperationButton>
      <OperationButton onClick={()=>setAction("load")}><PackagePlus size={14}/>Ajouter des colis</OperationButton>
      {!!item.packages_count&&<OperationButton onClick={()=>setAction("remove")}><PackageMinus size={14}/>Retirer des colis</OperationButton>}
      <OperationButton variant="primary" disabled={!item.packages_count} onClick={()=>setAction("depart")}><Plane size={14}/>Confirmer le départ</OperationButton>
      <OperationButton variant="danger" onClick={onCancel}><Ban size={14}/>Annuler l’expédition</OperationButton>
    </></PermissionGuard>}
    {item.stage==="departed"&&<PermissionGuard permission="shipments.update"><>
      <OperationButton variant="primary" onClick={()=>setAction("arrive")}><PlaneLanding size={14}/>Confirmer l’arrivée</OperationButton>
      <OperationButton onClick={()=>setAction("delay")}><TriangleAlert size={14}/>{item.is_delayed?"Résoudre le retard":"Signaler un retard"}</OperationButton>
    </></PermissionGuard>}
    <PermissionGuard permission="shipments.read"><OperationButton onClick={onManifest}><Printer size={14}/>Manifeste PDF</OperationButton></PermissionGuard>
    {action==="load"?<Loading item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action==="remove"?<Unloading item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action==="delay"?<Delay item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action&&<Milestone item={item} action={action} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>}
  </div>;
}

function Delay({item,close,saved}:{item:Shipment;close:()=>void;saved:()=>void}){
  const [reason,setReason]=useState("");const [saving,setSaving]=useState(false);const [error,setError]=useState("");const pending=useRef(false);
  async function submit(){if(pending.current||reason.trim().length<3)return;pending.current=true;setSaving(true);setError("");try{await api.post(`/shipments/workspace/${item.id}/delay`,{expected_version:item.version,delayed:!item.is_delayed,reason:reason.trim()});saved();}catch(cause){setError(failure(cause));}finally{pending.current=false;setSaving(false);}}
  return <OperationDrawer open title={item.is_delayed?"Résoudre le retard":"Signaler un retard"} placement="right" width="max-w-xl" close={()=>{if(!pending.current)close();}}><p className="mb-5 text-sm text-slate-500">Information interne historisée. L’état physique des colis ne change pas et aucun message n’est envoyé automatiquement. Le planning reste modifiable séparément avant le départ.</p><label className="grid gap-2 text-sm">Motif<input className={field} value={reason} disabled={saving} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><OperationButton disabled={saving} onClick={close}>Annuler</OperationButton><OperationButton variant="primary" disabled={saving||reason.trim().length<3} onClick={submit}>{saving?"Enregistrement…":"Enregistrer"}</OperationButton></div></OperationDrawer>;
}

function Loading({item,close,saved}:{item:Shipment;close:()=>void;saved:()=>void}){
  const [q,setQ]=useState("");const [page,setPage]=useState(1);const [data,setData]=useState<Candidates|null>(null);
  const [selected,setSelected]=useState<Set<string>>(new Set());const [saving,setSaving]=useState(false);const [error,setError]=useState("");const pending=useRef(false);
  useEffect(()=>{const controller=new AbortController();setData(null);setError("");
    const timer=setTimeout(()=>{api.get<Candidates>(`/shipments/workspace/${item.id}/candidates`,{params:{q,page},signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setData(r.data);}).catch(()=>{if(!controller.signal.aborted)setError("Colis indisponibles. Fermez ce panneau et réessayez.");});},220);
    return()=>{clearTimeout(timer);controller.abort();};},[item.id,q,page]);
  async function submit(){if(pending.current||!selected.size)return;pending.current=true;setSaving(true);setError("");
    try{await api.post(`/shipments/workspace/${item.id}/loading`,{expected_version:item.version,package_ids:[...selected]});saved();}catch(cause){setError(failure(cause));}finally{pending.current=false;setSaving(false);}}
  return <OperationDrawer open title="Ajouter des colis" description={`Expédition ${item.reference}`} placement="center" width="max-w-2xl" close={()=>{if(!pending.current)close();}}>
    <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-medium text-slate-800">{item.route_label||"Route de l’expédition"}</p><p className="mt-1 text-xs text-slate-500">Colis disponibles et compatibles avec cette expédition. L’ajout ne confirme pas le départ.</p></div>
    <label className="relative block"><span className="sr-only">Rechercher un colis ou un client</span><input type="search" className={field} aria-label="Rechercher un colis ou un client" placeholder="Rechercher une référence ou un client…" maxLength={120} disabled={saving} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label>
    <div className="my-4 max-h-[45vh] overflow-y-auto rounded-lg border border-slate-200">{!data?<p className="px-4 py-6 text-sm text-slate-500">{error?"Chargement interrompu.":"Recherche des colis…"}</p>:!data.items.length?<p className="px-4 py-6 text-sm text-slate-500">Aucun colis disponible sur cette route.</p>:data.items.map(parcel=><label key={parcel.id} className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 ${selected.has(parcel.id)?"bg-emerald-50/60":"hover:bg-slate-50"}`}><input className="h-4 w-4 shrink-0 accent-emerald-700" type="checkbox" checked={selected.has(parcel.id)} disabled={saving||!!parcel.blockers.length||(!selected.has(parcel.id)&&selected.size>=200)} onChange={e=>setSelected(current=>{const next=new Set(current);if(e.target.checked)next.add(parcel.id);else next.delete(parcel.id);return next;})}/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{parcel.reference}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{parcel.client_name||"Client non renseigné"}</span>{!!parcel.blockers.length&&<span className="mt-1 block text-xs text-amber-800">{parcel.blockers.map(key=>reasons[key]||key).join(" · ")}</span>}</span><span className="shrink-0 text-xs text-slate-500">{parcel.weight_kg==null?"Poids inconnu":`${parcel.weight_kg} kg`}</span></label>)}</div>
    {data&&data.total_pages>1&&<div className="mb-4 flex justify-between gap-2"><OperationButton disabled={saving||page===1} onClick={()=>setPage(p=>p-1)}>Précédent</OperationButton><span className="self-center text-xs">{page}/{data.total_pages}</span><OperationButton disabled={saving||page>=data.total_pages} onClick={()=>setPage(p=>p+1)}>Suivant</OperationButton></div>}
    {error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2"><span className="mr-auto text-xs text-slate-500">{selected.size} colis sélectionné{selected.size>1?"s":""}</span><OperationButton onClick={close} disabled={saving}>Annuler</OperationButton><OperationButton variant="primary" disabled={saving||!selected.size} onClick={submit}>{saving?"Ajout…":`Ajouter ${selected.size} colis`}</OperationButton></div>
  </OperationDrawer>;
}

function Unloading({item,close,saved}:{item:Shipment;close:()=>void;saved:()=>void}){
  const [q,setQ]=useState("");const [page,setPage]=useState(1);const [data,setData]=useState<Candidates|null>(null);
  const [selected,setSelected]=useState<Set<string>>(new Set());const [saving,setSaving]=useState(false);const [error,setError]=useState("");const pending=useRef(false);
  useEffect(()=>{const controller=new AbortController();setData(null);setError("");
    const timer=setTimeout(()=>{api.get<Candidates>(`/shipments/workspace/${item.id}/packages`,{params:{q,page},signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setData(r.data);}).catch(()=>{if(!controller.signal.aborted)setError("Colis associés indisponibles. Fermez ce panneau et réessayez.");});},220);
    return()=>{clearTimeout(timer);controller.abort();};},[item.id,q,page]);
  async function submit(){if(pending.current||!selected.size)return;pending.current=true;setSaving(true);setError("");
    try{await api.post(`/shipments/workspace/${item.id}/loading`,{expected_version:item.version,package_ids:[...selected],remove:true});saved();}catch(cause){setError(failure(cause));}finally{pending.current=false;setSaving(false);}}
  return <OperationDrawer open title="Retirer des colis" placement="right" width="max-w-2xl" close={()=>{if(!pending.current)close();}}>
    <p className="mb-4 text-sm text-slate-500">{item.reference} · {item.packages_count} colis associés. Le retrait libère le colis pour une autre expédition sans modifier son état physique.</p>
    <input type="search" className={field} aria-label="Rechercher un colis associé" placeholder="Rechercher un colis ou un client…" maxLength={120} disabled={saving} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/>
    <div className="my-4 max-h-[45vh] overflow-y-auto">{!data?<p className="py-4 text-sm">{error?"Chargement interrompu.":"Recherche des colis associés…"}</p>:!data.items.length?<p className="py-4 text-sm">Aucun colis associé ne correspond à la recherche.</p>:data.items.map(parcel=><label key={parcel.id} className="flex items-center gap-3 border-b border-slate-100 py-3 text-sm"><input className="accent-emerald-700" type="checkbox" checked={selected.has(parcel.id)} disabled={saving||(!selected.has(parcel.id)&&selected.size>=200)} onChange={e=>setSelected(current=>{const next=new Set(current);if(e.target.checked)next.add(parcel.id);else next.delete(parcel.id);return next;})}/><span className="min-w-0 flex-1"><span className="font-medium">{parcel.reference}</span><span className="block text-xs text-slate-500">{parcel.client_name||"Client non renseigné"}</span></span><span className="text-xs text-slate-500">{parcel.weight_kg==null?"Poids inconnu":`${parcel.weight_kg} kg`}</span></label>)}</div>
    {data&&data.total_pages>1&&<div className="mb-4 flex justify-between gap-2"><OperationButton disabled={saving||page===1} onClick={()=>setPage(value=>value-1)}>Précédent</OperationButton><span className="self-center text-xs">{page}/{data.total_pages}</span><OperationButton disabled={saving||page>=data.total_pages} onClick={()=>setPage(value=>value+1)}>Suivant</OperationButton></div>}
    {error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2"><span className="mr-auto text-xs">{selected.size} sélectionné(s)</span><OperationButton onClick={close} disabled={saving}>Annuler</OperationButton><OperationButton variant="primary" disabled={saving||!selected.size} onClick={submit}>{saving?"Retrait…":`Retirer ${selected.size||0} colis`}</OperationButton></div>
  </OperationDrawer>;
}

function Milestone({item,action,close,saved}:{item:Shipment;action:"depart"|"arrive";close:()=>void;saved:()=>void}){
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");const pending=useRef(false);
  async function submit(){if(pending.current)return;pending.current=true;setSaving(true);setError("");try{await api.post(`/shipments/workspace/${item.id}/milestone`,{expected_version:item.version,action});saved();}catch(cause){setError(failure(cause));}finally{pending.current=false;setSaving(false);}}
  return <OperationDrawer open title={action==="depart"?"Confirmer le départ réel":"Confirmer l’arrivée réelle"} placement="right" width="max-w-xl" close={()=>{if(!pending.current)close();}}><p className="mb-4 text-sm">{item.reference} · {item.packages_count} colis</p><p className="mb-6 text-sm text-slate-600">{action==="depart"?"Confirmez uniquement lorsque le chargement est réellement parti. Le manifeste sera figé et les colis passeront à l’état Expédié. Les contrôles de paiement configurés seront vérifiés.":"Confirmez uniquement après réception du mouvement à destination. Les colis passeront à l’état Arrivé, pas Livré."} Les notifications clients seront mises en file selon les réglages de l’agence.</p>{error&&<p role="alert" className="mb-5 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><OperationButton disabled={saving} onClick={close}>Annuler</OperationButton><OperationButton disabled={saving} variant="primary" onClick={submit}>{saving?"Confirmation…":"Confirmer"}</OperationButton></div></OperationDrawer>;
}

export function RemoveFreightParcel({item,parcelId,saved}:{item:Shipment;parcelId:string;saved:()=>void}){
  const [confirm,setConfirm]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState("");const pending=useRef(false);
  if(item.workflow_version!==2||item.stage!=="planned")return null;
  async function remove(){if(pending.current)return;pending.current=true;setSaving(true);setError("");try{await api.post(`/shipments/workspace/${item.id}/loading`,{expected_version:item.version,package_ids:[parcelId],remove:true});saved();}catch(cause){setError(failure(cause));}finally{pending.current=false;setSaving(false);}}
  return <PermissionGuard permission="shipments.update"><OperationButton className="mt-2" onClick={()=>setConfirm(true)}>Retirer du chargement</OperationButton>{confirm&&<OperationDrawer open title="Retirer ce colis ?" placement="right" width="max-w-xl" close={()=>{if(!pending.current)setConfirm(false);}}><p className="mb-5 text-sm">Le colis reste enregistré dans le bureau et conserve son état physique.</p>{error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><OperationButton disabled={saving} onClick={()=>setConfirm(false)}>Annuler</OperationButton><OperationButton disabled={saving} onClick={remove}>{saving?"Retrait…":"Confirmer le retrait"}</OperationButton></div></OperationDrawer>}</PermissionGuard>;
}

type Manifest={agency_brand?:{organization_name?:string;legal_name?:string;logo_url?:string|null;office_name?:string|null;office_address?:string|null;address?:string|null;office_phone?:string|null;phone?:string|null};historical_snapshot:boolean;departed_at:string|null;shipment:{reference:string;origin_city:string|null;origin_country:string|null;destination_city:string|null;destination_country:string|null;planned_departure_at:string|null};items:{id:string;reference:string;client_name:string|null;supplier_tracking:string|null;weight_kg:number|string|null;destination_city:string|null;destination_country:string|null}[]};
export function FreightManifest({shipmentId,revision,compact=false}:{shipmentId:string;revision:number;compact?:boolean}){
  const [data,setData]=useState<Manifest|null>(null);const [error,setError]=useState("");const [downloading,setDownloading]=useState(false);
  const [q,setQ]=useState("");const [page,setPage]=useState(1);
  useEffect(()=>{const controller=new AbortController();setData(null);setError("");api.get<Manifest>(`/shipments/workspace/${shipmentId}/manifest`,{signal:controller.signal}).then(r=>{
    if(controller.signal.aborted)return;
    if(!r.data || !Array.isArray(r.data.items) || !r.data.shipment || typeof r.data.shipment!=='object' || r.data.items.some(row=>!row || typeof row.reference!=='string')){
      setError("Le manifeste reçu est incomplet. Réessayez ou contactez le support Slaivio.");return;
    }
    setData(r.data);
  }).catch(cause=>{if(!controller.signal.aborted)setError(axios.isAxiosError(cause)&&cause.response?.status===409?"Aucun manifeste figé n’existe pour ce départ historique. La composition actuelle ne remplace pas une archive.":"Manifeste indisponible. Actualisez la fiche.");});return()=>controller.abort();},[shipmentId,revision]);
  async function download(){setDownloading(true);setError("");try{const response=await api.get(`/shipments/workspace/${shipmentId}/manifest.xlsx`,{responseType:"blob"});const url=URL.createObjectURL(response.data);const anchor=document.createElement("a");anchor.href=url;anchor.download=`manifest-${shipmentId}.xlsx`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError("Export indisponible. Réessayez.");}finally{setDownloading(false);}}
  const filtered=data?.items.filter(row=>[row.reference,row.client_name,row.supplier_tracking].some(value=>value?.toLocaleLowerCase().includes(q.toLocaleLowerCase())))||[];
  const weighed=data?.items.filter(row=>row.weight_kg!==null)||[];
  const weight=weighed.length?new Intl.NumberFormat("fr").format(weighed.reduce((sum,row)=>sum+Number(row.weight_kg),0)):null;
  const route=data?`${[data.shipment.origin_city,data.shipment.origin_country].filter(Boolean).join(", ")} → ${[data.shipment.destination_city,data.shipment.destination_country].filter(Boolean).join(", ")}`:"";
  return <section aria-label="Manifeste">{error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}{!data?!error&&<p className="text-sm">Chargement du manifeste…</p>:<>
    {compact?<div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xs font-semibold">Manifeste</h2><p className="mt-1 text-[11px] text-slate-500">{data.historical_snapshot?"Liste figée des colis au départ":"Liste des colis associés au départ"} · {data.items.length} colis</p></div><div className="flex gap-2"><OperationButton disabled={downloading} onClick={download}><Download size={14}/>Excel</OperationButton><OperationButton onClick={()=>window.print()}><Printer size={14}/>PDF</OperationButton></div></div>:<div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">{data.historical_snapshot?"Manifeste figé au départ":"Manifeste de préparation"}</h2><p className="mt-2 text-xs text-slate-500">{data.items.length} colis · {weighed.length} pesés · {weight===null?"Poids inconnu":`${weight} kg renseignés`}</p><p className="mt-1 text-xs text-slate-500">{data.departed_at?`Départ réel : ${new Date(data.departed_at).toLocaleString("fr")}`:"Composition modifiable jusqu’au départ"}</p></div><div className="flex flex-wrap gap-2"><OperationButton disabled={downloading} onClick={download}><Download size={15}/>Excel</OperationButton><OperationButton onClick={()=>window.print()}><Printer size={15}/>Imprimer / PDF</OperationButton></div></div>}
    {!compact&&<><input type="search" className={`${field} mb-4 sm:max-w-sm`} aria-label="Rechercher dans le manifeste" placeholder="Référence, client ou tracking…" maxLength={120} value={q} onChange={event=>{setQ(event.target.value);setPage(1);}}/>
    <ul className="divide-y divide-slate-100">{filtered.slice((page-1)*50,page*50).map(parcel=><li key={parcel.id} className="grid gap-1 py-3 text-sm sm:grid-cols-3"><div><p className="font-medium">{parcel.reference}</p><p className="text-xs text-slate-500">{parcel.supplier_tracking||"Sans tracking externe"}</p></div><span>{parcel.client_name||"Client non renseigné"}</span><span className="text-slate-500">{parcel.weight_kg===null?"Non pesé":`${parcel.weight_kg} kg`} · {[parcel.destination_city,parcel.destination_country].filter(Boolean).join(", ")}</span></li>)}</ul>
    {!filtered.length&&<p className="py-4 text-sm text-slate-500">Aucun colis correspondant.</p>}
    {filtered.length>50&&<div className="mt-4 flex justify-end gap-2"><OperationButton disabled={page===1} onClick={()=>setPage(p=>p-1)}>Précédent</OperationButton><span className="self-center text-xs">{page}/{Math.ceil(filtered.length/50)}</span><OperationButton disabled={page*50>=filtered.length} onClick={()=>setPage(p=>p+1)}>Suivant</OperationButton></div>}</>}
    {data.agency_brand && createPortal(<header data-freight-print="true" className="hidden">{data.agency_brand.logo_url && /^https:\/\//i.test(data.agency_brand.logo_url) && <div role="img" aria-label="Logo de l’agence" style={{height:64,width:160,backgroundImage:`url(${JSON.stringify(data.agency_brand.logo_url)})`,backgroundSize:'contain',backgroundRepeat:'no-repeat'}}/>}<h2>{data.agency_brand.legal_name || data.agency_brand.organization_name}</h2><p>{data.agency_brand.office_name}<br/>{data.agency_brand.office_address || data.agency_brand.address}<br/>{data.agency_brand.office_phone || data.agency_brand.phone}</p></header>,document.body)}
    {createPortal(<div data-freight-print="true" className="hidden"><style>{`@media print {body > *:not([data-freight-print]) {display:none!important} [data-freight-print] {display:block!important;color:#111;font:11px Arial,sans-serif} [data-freight-print] table {width:100%;border-collapse:collapse} [data-freight-print] th,[data-freight-print] td {padding:8px;text-align:left;border-bottom:1px solid #ddd} [data-freight-print] tr {break-inside:avoid} [data-freight-print] thead {display:table-header-group}} @page {size:A4 landscape;margin:15mm}`}</style><h1>Manifeste {data.shipment.reference}</h1><p>{route}</p><p>{data.historical_snapshot?"Composition figée au départ":"Préparation — ne vaut pas confirmation de départ"}</p><p>Départ {data.departed_at?`réel : ${new Date(data.departed_at).toLocaleString("fr")}`:`prévu : ${data.shipment.planned_departure_at?new Date(data.shipment.planned_departure_at).toLocaleString("fr"):"Non déterminé"}`}</p><p>{data.items.length} colis · {weighed.length} pesés · {weight===null?"Poids inconnu":`${weight} kg renseignés`}</p><table><thead><tr>{["N°","Colis","Client","Tracking externe","Poids kg","Destination"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map((row,index)=><tr key={row.id}><td>{index+1}</td><td>{row.reference}</td><td>{row.client_name||"—"}</td><td>{row.supplier_tracking||"—"}</td><td>{row.weight_kg??"Non pesé"}</td><td>{[row.destination_city,row.destination_country].filter(Boolean).join(", ")}</td></tr>)}</tbody></table></div>,document.body)}
  </>}</section>;
}
