"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Download, Plus, Printer, Truck } from "lucide-react";
import { createPortal } from "react-dom";
import { api } from "@/services/api";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { PermissionGuard } from "@/components/permissions/permission-guard";

type Shipment = {id:string;reference:string;version:number;workflow_version?:number;stage:string;packages_count:number;is_delayed?:boolean};
type Candidate = {id:string;reference:string;client_name:string|null;blockers:string[]};
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

export function FreightWorkflow({item,saved}:{item:Shipment;saved:()=>void}){
  const [action,setAction]=useState<"load"|"depart"|"arrive"|"delay"|null>(null);
  if(item.workflow_version!==2)return <p className="mb-5 text-xs text-amber-800">Expédition historique : consultation disponible. Sa reprise doit être vérifiée avant d’utiliser les nouvelles commandes.</p>;
  return <PermissionGuard permission="shipments.update"><div className="mb-5 flex flex-wrap justify-end gap-2">
    {item.stage==="planned"&&<><OperationButton onClick={()=>setAction("load")}><Plus size={15}/>Ajouter des colis</OperationButton><OperationButton variant="primary" disabled={!item.packages_count} onClick={()=>setAction("depart")}><Truck size={15}/>Confirmer le départ</OperationButton></>}
    {item.stage==="departed"&&<OperationButton variant="primary" onClick={()=>setAction("arrive")}>Confirmer l’arrivée</OperationButton>}
    {["planned","departed"].includes(item.stage)&&<OperationButton onClick={()=>setAction("delay")}>{item.is_delayed?"Résoudre le retard":"Signaler un retard"}</OperationButton>}
    {action==="load"?<Loading item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action==="delay"?<Delay item={item} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>:action&&<Milestone item={item} action={action} close={()=>setAction(null)} saved={()=>{setAction(null);saved();}}/>}
  </div></PermissionGuard>;
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
  return <OperationDrawer open title="Préparer le chargement" placement="right" width="max-w-2xl" close={()=>{if(!pending.current)close();}}>
    <p className="mb-4 text-sm text-slate-500">Colis du bureau actif sur cette route. L’affectation ne confirme pas le départ. Maximum 200 colis par opération.</p>
    <input type="search" className={field} aria-label="Rechercher un colis à affecter" placeholder="Référence, tracking ou client…" maxLength={120} disabled={saving} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/>
    <div className="my-4 max-h-[45vh] overflow-y-auto">{!data?<p className="py-4 text-sm">{error?"Chargement interrompu.":"Recherche des colis…"}</p>:!data.items.length?<p className="py-4 text-sm">Aucun colis disponible sur cette route.</p>:data.items.map(parcel=><label key={parcel.id} className="flex items-start gap-3 border-b border-slate-100 py-3 text-sm"><input className="mt-1 accent-emerald-700" type="checkbox" checked={selected.has(parcel.id)} disabled={saving||!!parcel.blockers.length||(!selected.has(parcel.id)&&selected.size>=200)} onChange={e=>setSelected(current=>{const next=new Set(current);if(e.target.checked)next.add(parcel.id);else next.delete(parcel.id);return next;})}/><span><span className="font-medium">{parcel.reference}</span><span className="block text-xs text-slate-500">{parcel.client_name||"Client non renseigné"}</span>{!!parcel.blockers.length&&<span className="block text-xs text-amber-800">{parcel.blockers.map(key=>reasons[key]||key).join(" · ")}</span>}</span></label>)}</div>
    {data&&data.total_pages>1&&<div className="mb-4 flex justify-between gap-2"><OperationButton disabled={saving||page===1} onClick={()=>setPage(p=>p-1)}>Précédent</OperationButton><span className="self-center text-xs">{page}/{data.total_pages}</span><OperationButton disabled={saving||page>=data.total_pages} onClick={()=>setPage(p=>p+1)}>Suivant</OperationButton></div>}
    {error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2"><span className="mr-auto text-xs">{selected.size} sélectionné(s)</span><OperationButton onClick={close} disabled={saving}>Annuler</OperationButton><OperationButton variant="primary" disabled={saving||!selected.size} onClick={submit}>{saving?"Affectation…":"Affecter les colis"}</OperationButton></div>
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

type Manifest={historical_snapshot:boolean;departed_at:string|null;shipment:{reference:string;origin_city:string|null;origin_country:string|null;destination_city:string|null;destination_country:string|null;planned_departure_at:string|null};items:{id:string;reference:string;client_name:string|null;supplier_tracking:string|null;weight_kg:number|string|null;destination_city:string|null;destination_country:string|null}[]};
export function FreightManifest({shipmentId,revision}:{shipmentId:string;revision:number}){
  const [data,setData]=useState<Manifest|null>(null);const [error,setError]=useState("");const [downloading,setDownloading]=useState(false);
  const [q,setQ]=useState("");const [page,setPage]=useState(1);
  useEffect(()=>{const controller=new AbortController();setData(null);setError("");api.get<Manifest>(`/shipments/workspace/${shipmentId}/manifest`,{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setData(r.data);}).catch(cause=>{if(!controller.signal.aborted)setError(axios.isAxiosError(cause)&&cause.response?.status===409?"Aucun manifeste figé n’existe pour ce départ historique. La composition actuelle ne remplace pas une archive.":"Manifeste indisponible. Actualisez la fiche.");});return()=>controller.abort();},[shipmentId,revision]);
  async function download(){setDownloading(true);setError("");try{const response=await api.get(`/shipments/workspace/${shipmentId}/manifest.xlsx`,{responseType:"blob"});const url=URL.createObjectURL(response.data);const anchor=document.createElement("a");anchor.href=url;anchor.download=`manifest-${shipmentId}.xlsx`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError("Export indisponible. Réessayez.");}finally{setDownloading(false);}}
  const filtered=data?.items.filter(row=>[row.reference,row.client_name,row.supplier_tracking].some(value=>value?.toLocaleLowerCase().includes(q.toLocaleLowerCase())))||[];
  const weighed=data?.items.filter(row=>row.weight_kg!==null)||[];
  const weight=weighed.length?new Intl.NumberFormat("fr").format(weighed.reduce((sum,row)=>sum+Number(row.weight_kg),0)):null;
  const route=data?`${[data.shipment.origin_city,data.shipment.origin_country].filter(Boolean).join(", ")} → ${[data.shipment.destination_city,data.shipment.destination_country].filter(Boolean).join(", ")}`:"";
  return <section aria-label="Manifeste">{error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}{!data?!error&&<p className="text-sm">Chargement du manifeste…</p>:<>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">{data.historical_snapshot?"Manifeste figé au départ":"Manifeste de préparation"}</h2><p className="mt-2 text-xs text-slate-500">{data.items.length} colis · {weighed.length} pesés · {weight===null?"Poids inconnu":`${weight} kg renseignés`}</p><p className="mt-1 text-xs text-slate-500">{data.departed_at?`Départ réel : ${new Date(data.departed_at).toLocaleString("fr")}`:"Composition modifiable jusqu’au départ"}</p></div><div className="flex flex-wrap gap-2"><OperationButton disabled={downloading} onClick={download}><Download size={15}/>Excel</OperationButton><OperationButton onClick={()=>window.print()}><Printer size={15}/>Imprimer / PDF</OperationButton></div></div>
    <input type="search" className={`${field} mb-4 sm:max-w-sm`} aria-label="Rechercher dans le manifeste" placeholder="Référence, client ou tracking…" maxLength={120} value={q} onChange={event=>{setQ(event.target.value);setPage(1);}}/>
    <ul className="divide-y divide-slate-100">{filtered.slice((page-1)*50,page*50).map(parcel=><li key={parcel.id} className="grid gap-1 py-3 text-sm sm:grid-cols-3"><div><p className="font-medium">{parcel.reference}</p><p className="text-xs text-slate-500">{parcel.supplier_tracking||"Sans tracking externe"}</p></div><span>{parcel.client_name||"Client non renseigné"}</span><span className="text-slate-500">{parcel.weight_kg===null?"Non pesé":`${parcel.weight_kg} kg`} · {[parcel.destination_city,parcel.destination_country].filter(Boolean).join(", ")}</span></li>)}</ul>
    {!filtered.length&&<p className="py-4 text-sm text-slate-500">Aucun colis correspondant.</p>}
    {filtered.length>50&&<div className="mt-4 flex justify-end gap-2"><OperationButton disabled={page===1} onClick={()=>setPage(p=>p-1)}>Précédent</OperationButton><span className="self-center text-xs">{page}/{Math.ceil(filtered.length/50)}</span><OperationButton disabled={page*50>=filtered.length} onClick={()=>setPage(p=>p+1)}>Suivant</OperationButton></div>}
    {createPortal(<div data-freight-print="true" className="hidden"><style>{`@media print {body > *:not([data-freight-print]) {display:none!important} [data-freight-print] {display:block!important;color:#111;font:11px Arial,sans-serif} [data-freight-print] table {width:100%;border-collapse:collapse} [data-freight-print] th,[data-freight-print] td {padding:8px;text-align:left;border-bottom:1px solid #ddd} [data-freight-print] tr {break-inside:avoid} [data-freight-print] thead {display:table-header-group}} @page {size:A4 landscape;margin:15mm}`}</style><h1>Manifeste {data.shipment.reference}</h1><p>{route}</p><p>{data.historical_snapshot?"Composition figée au départ":"Préparation — ne vaut pas confirmation de départ"}</p><p>Départ {data.departed_at?`réel : ${new Date(data.departed_at).toLocaleString("fr")}`:`prévu : ${data.shipment.planned_departure_at?new Date(data.shipment.planned_departure_at).toLocaleString("fr"):"Non déterminé"}`}</p><p>{data.items.length} colis · {weighed.length} pesés · {weight===null?"Poids inconnu":`${weight} kg renseignés`}</p><table><thead><tr>{["N°","Colis","Client","Tracking externe","Poids kg","Destination"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map((row,index)=><tr key={row.id}><td>{index+1}</td><td>{row.reference}</td><td>{row.client_name||"—"}</td><td>{row.supplier_tracking||"—"}</td><td>{row.weight_kg??"Non pesé"}</td><td>{[row.destination_city,row.destination_country].filter(Boolean).join(", ")}</td></tr>)}</tbody></table></div>,document.body)}
  </>}</section>;
}
