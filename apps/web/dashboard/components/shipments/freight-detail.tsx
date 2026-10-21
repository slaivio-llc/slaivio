"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { TableSkeleton } from "@/components/ui/page-state";
import { FreightWorkflow, FreightManifest } from "./freight-workflow";

type Overview={id:string;reference:string;stage:string;status:string;version:number;workflow_version?:number;mode?:string|null;service_type?:string|null;origin_city:string|null;origin_country:string|null;destination_city:string|null;destination_country:string|null;route_label:string|null;planned_departure_at:string|null;departed_at:string|null;arrived_at:string|null;created_at:string;packages_count:number;clients_count:number;weighed_count:number;known_weight_kg:number|null;is_delayed:boolean;delay_reason:string|null};
type Parcel={id:string;reference:string;client_name:string|null;supplier_tracking:string|null;weight_kg:number|null;destination_city:string|null;destination_country:string|null;status:string};
type Event={id:string;title:string;description:string|null;created_at:string;event_type:string;previous_planned_at:string|null;next_planned_at:string|null};
type Communication={id:string;notification_type:string;channel:string;status:string;created_at:string;sent_at:string|null;failed_at:string|null};
type Page<T>={items:T[];page:number;total_pages:number;total?:number};
function date(value:string|null){return value?new Intl.DateTimeFormat("fr",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"Non renseigné";}
function shortDate(value:string|null){return value?new Intl.DateTimeFormat("fr",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value)):"—";}
function location(city:string|null,country:string|null){return [city,country].filter(Boolean).join(", ")||"Non renseigné";}
function useResource<T>(url:string,revision:number){
  const [data,setData]=useState<T|null>(null);const [error,setError]=useState(false);
  useEffect(()=>{const controller=new AbortController();setData(null);setError(false);
    api.get<T>(url,{signal:controller.signal}).then(response=>{if(!controller.signal.aborted)setData(response.data);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();},[url,revision]);
  return {data,error};
}
function Pages({page,total,change}:{page:number;total:number;change:(page:number)=>void}){return <div className="mt-5 flex justify-end gap-2"><OperationButton className="w-9 px-0" aria-label="Page précédente" disabled={page===1} onClick={()=>change(page-1)}><ChevronLeft size={15}/></OperationButton><span className="self-center text-xs text-slate-500">{page} / {Math.max(1,total)}</span><OperationButton className="w-9 px-0" aria-label="Page suivante" disabled={page>=total} onClick={()=>change(page+1)}><ChevronRight size={15}/></OperationButton></div>;}

export function FreightShipmentDetail({shipmentId,onClose}:{shipmentId:string;onClose?:()=>void}){
  const router=useRouter();
  const [revision,setRevision]=useState(0);const [planning,setPlanning]=useState(false);const [cancelOpen,setCancelOpen]=useState(false);
  const [tab,setTab]=useState<"packages"|"tracking"|"history">("packages");
  const {data:item,error}=useResource<Overview>(`/shipments/workspace/${encodeURIComponent(shipmentId)}`,revision);
  const refresh=()=>setRevision(value=>value+1);
  const close=()=>onClose?onClose():router.replace("/app/operations?view=shipments");
  return <OperationDrawer open close={close} title={item ? `Expédition ${item.reference}` : "Fiche expédition"} description={item ? date(item.created_at) : "Opérations / Expéditions"} placement="center" width="max-w-[650px]" variant="detail" headerMeta={item ? <ShipmentStatus item={item}/> : undefined} headerActions={<OperationButton aria-label="Actualiser l’expédition" className="w-9 px-0" onClick={refresh}><RefreshCw size={14}/></OperationButton>}>
      {error?<p role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm">Expédition indisponible ou accès non autorisé. <button className="underline" onClick={refresh}>Réessayer</button></p>:!item?<TableSkeleton rows={5} columns={2}/>:<div className="grid w-full gap-3">
        <section className="rounded-lg bg-slate-50 p-3" aria-label="Résumé de l’expédition"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-900">{item.reference}</p><ShipmentStatus item={item}/></div><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-slate-800">{location(item.origin_city,item.origin_country)} <span className="text-slate-400">→</span> {location(item.destination_city,item.destination_country)}</p><span className="shrink-0 text-[11px] text-slate-500">{modeLabel(item.mode)}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs"><Fact label="Départ prévu">{item.planned_departure_at?shortDate(item.planned_departure_at):"Non planifié"}</Fact><Fact label="Arrivée">{item.arrived_at?shortDate(item.arrived_at):"Non confirmée"}</Fact></dl>{item.is_delayed&&item.delay_reason&&<p className="mt-2 text-xs text-amber-800">{item.delay_reason}</p>}</section>
        <section className="grid grid-cols-3 gap-2" aria-label="Indicateurs de l’expédition"><Metric label="Colis" value={item.packages_count}/><Metric label="Clients" value={item.clients_count}/><Metric label="Poids" value={item.known_weight_kg===null?"—":`${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(Number(item.known_weight_kg))} kg`}/></section>
        <section className="flex flex-wrap items-center gap-2" aria-label="Actions de l’expédition"><FreightManifest shipmentId={shipmentId} revision={revision} compact/><FreightWorkflow item={item} saved={refresh} onPlan={()=>setPlanning(true)} onCancel={()=>setCancelOpen(true)} compact/></section>
        <nav aria-label="Vues de l’expédition" className="flex gap-5 border-b border-slate-200"><TabButton active={tab==="packages"} onClick={()=>setTab("packages")}>Colis ({item.packages_count})</TabButton><TabButton active={tab==="tracking"} onClick={()=>setTab("tracking")}>Suivi</TabButton><TabButton active={tab==="history"} onClick={()=>setTab("history")}>Historique</TabButton></nav>
        <div role="tabpanel" className="min-h-48">
          {tab==="packages"&&<section aria-label="Colis associés"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Colis associés</h2>{item.stage==="planned"&&item.workflow_version===2&&<span className="text-[11px] text-slate-500">Ajout disponible dans « Autres actions »</span>}</div><AssignedCargo shipmentId={shipmentId} revision={revision}/>{item.stage!=="planned"&&item.workflow_version===2&&<p className="mt-3 text-[11px] text-slate-500">{item.status==="CANCELLED"?"L’expédition a été annulée; le chargement ne peut plus être modifié.":item.stage==="arrived"?"L’ajout de colis est désactivé car cette expédition est arrivée.":"Le départ est confirmé; le chargement ne peut plus être modifié."}</p>}</section>}
          {tab==="tracking"&&<section className="grid gap-5"><div><h2 className="mb-4 text-sm font-semibold">Progression</h2><ShipmentProgress item={item}/></div><div className="border-t border-slate-100 pt-4"><h2 className="mb-3 text-sm font-semibold">Notifications</h2><Communications shipmentId={shipmentId} revision={revision}/></div></section>}
          {tab==="history"&&<History shipmentId={shipmentId} revision={revision}/>}
        </div>
        {planning&&<Planning item={item} close={()=>setPlanning(false)} saved={()=>{setPlanning(false);refresh();}}/>}
        {cancelOpen&&<CancelShipment item={item} close={()=>setCancelOpen(false)} saved={()=>{setCancelOpen(false);refresh();}}/>}
      </div>}
  </OperationDrawer>;
}

function modeLabel(value:string|null|undefined){return ({AIR:"Aérien",SEA:"Maritime",ROAD:"Routier",EXPRESS:"Express",GROUPAGE:"Groupage",OTHER:"Autre"} as Record<string,string>)[value||""]||"Mode non renseigné";}
function Metric({label,value}:{label:string;value:string|number}){return <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"><span className="block text-[10px] text-slate-500">{label}</span><strong className="mt-1 block truncate text-sm font-semibold text-slate-900">{value}</strong></div>;}
function TabButton({active,onClick,children}:{active:boolean;onClick:()=>void;children:ReactNode}){return <button type="button" aria-current={active?"page":undefined} onClick={onClick} className={`inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-medium transition-colors ${active?"bg-[#111111] text-white":"text-[#68717d] hover:bg-[#f2f3f3] hover:text-[#17212b]"}`}>{children}</button>;}

function Fact({label,children}:{label:string;children:ReactNode}){return <div className="min-w-0"><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs text-slate-800">{children}</dd></div>;}
function ShipmentStatus({item}:{item:Overview}){const label=item.status==="CANCELLED"?"Annulée":item.stage==="planned"?"Prévue":item.stage==="departed"?"Partie":item.stage==="arrived"?"Arrivée":"Autre état";return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${item.stage==="arrived"?"bg-emerald-50 text-emerald-800":item.status==="CANCELLED"?"bg-red-50 text-red-700":"bg-slate-100 text-slate-700"}`}>{label}</span>;}
function ShipmentProgress({item}:{item:Overview}){const steps=[{label:"Prévue",date:item.planned_departure_at,key:"planned"},{label:"Partie",date:item.departed_at,key:"departed"},{label:"Arrivée",date:item.arrived_at,key:"arrived"}];const active=steps.findIndex(step=>step.key===item.stage);return <ol className="grid grid-cols-3">{steps.map((step,index)=>{const done=Boolean(step.date)||active>index;return <li key={step.key} className="relative flex min-w-0 flex-col items-center text-center">{index>0&&<span aria-hidden="true" className={`absolute right-1/2 top-2.5 h-px w-full ${done?"bg-emerald-600":"bg-slate-200"}`}/>}<span className={`relative z-10 grid h-5 w-5 place-items-center rounded-full text-[10px] ${done||active===index?"bg-emerald-700 text-white":"bg-slate-200 text-slate-500"}`}>{done||active===index?"✓":"•"}</span><span className="mt-1 text-[10px] font-medium text-slate-700">{step.label}</span><span className="text-[9px] text-slate-500">{step.date?shortDate(step.date):active===index?"En cours":"—"}</span></li>;})}</ol>;}

function History({shipmentId,revision}:{shipmentId:string;revision:number}){
  const [page,setPage]=useState(1);const {data,error}=useResource<Page<Event>>(`/shipments/workspace/${encodeURIComponent(shipmentId)}/history?page=${page}`,revision);
  return <section className="mt-2" aria-label="Historique opérationnel"><h2 className="mb-4 text-xs font-semibold">Historique</h2>{error?<p role="alert">Historique indisponible. Actualisez la fiche.</p>:!data?<TableSkeleton rows={3} columns={1}/>:<><ol className="space-y-3">{data.items.map(event=><li key={event.id} className="border-l-2 border-slate-200 pl-3"><p className="text-xs font-medium">{event.title}</p><time className="text-[10px] text-slate-500" dateTime={event.created_at}>{date(event.created_at)}</time>{event.event_type==="SHIPMENT_PLANNING_CHANGED"&&<p className="mt-1 text-[11px] text-slate-500">{date(event.previous_planned_at)} → {date(event.next_planned_at)}</p>}{event.description&&<p className="mt-1 text-xs text-slate-600">{event.description}</p>}</li>)}</ol>{!data.items.length&&<p className="text-sm text-slate-500">Aucun événement opérationnel enregistré.</p>}{data.total_pages>1&&<Pages page={page} total={data.total_pages} change={setPage}/>}</>}</section>;
}

function AssignedCargo({shipmentId,revision}:{shipmentId:string;revision:number}){
  const [q,setQ]=useState("");const [query,setQuery]=useState("");const [page,setPage]=useState(1);
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(q);setPage(1);},220);return()=>clearTimeout(timer);},[q]);
  const {data,error}=useResource<Page<Parcel>>(`/shipments/workspace/${encodeURIComponent(shipmentId)}/packages?q=${encodeURIComponent(query)}&page=${page}`,revision);
  return <section aria-label="Colis affectés">
    <input type="search" aria-label="Rechercher dans les colis affectés" placeholder="Référence, client ou tracking…" maxLength={120} value={q} onChange={event=>setQ(event.target.value)} className={`${field} mb-4 sm:max-w-sm`}/>
    {error?<p role="alert">Colis indisponibles. Actualisez la fiche.</p>:!data?<TableSkeleton rows={5} columns={4}/>:<>
      {!data.items.length?<p className="py-6 text-sm text-slate-500">{query?"Aucun colis correspondant.":"Aucun colis affecté à cette expédition."}</p>:<><div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-xs"><thead className="text-[10px] text-slate-500"><tr>{["Référence","Client","Statut"].map(label=><th key={label} scope="col" className="border-b border-slate-100 px-2 py-2 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.items.map(parcel=><tr key={parcel.id}><td className="px-2 py-3"><Link className="font-medium text-emerald-800 hover:underline" href={`/app/packages?open=${encodeURIComponent(parcel.id)}`}>{parcel.reference}</Link></td><td className="px-2 py-3">{parcel.client_name||"Non renseigné"}</td><td className="px-2 py-3"><span className="rounded-full bg-slate-100 px-2 py-1">{parcel.status==="ARRIVED_DESTINATION"?"Arrivé":parcel.status==="SHIPPED"?"Expédié":parcel.status}</span></td></tr>)}</tbody></table></div></>}
      {data.total_pages>1&&<Pages page={page} total={data.total_pages} change={setPage}/>}</>}
  </section>;
}

function Communications({shipmentId,revision}:{shipmentId:string;revision:number}){
  const [page,setPage]=useState(1);const {data,error}=useResource<Page<Communication>>(`/shipments/workspace/${encodeURIComponent(shipmentId)}/communications?page=${page}`,revision);
  const labels:Record<string,string>={PENDING:"En attente",QUEUED:"En file",SENT:"Envoyé",DELIVERED:"Livré",FAILED:"Échec",CANCELLED:"Annulé"};
  return <section><p className="mb-5 text-sm text-slate-500">Demandes de communication enregistrées pour l’expédition. Une demande en attente ne prouve pas un envoi au client ; les jalons du nouveau parcours sont reliés au journal d’envoi. Les anciens messages peuvent rester dans la fiche Colis.</p>{error?<p role="alert">Communications indisponibles. Actualisez la fiche.</p>:!data?<TableSkeleton rows={3} columns={2}/>:<>{!data.items.length?<p className="text-sm">Aucune demande de communication enregistrée pour cette expédition.</p>:<ul className="divide-y divide-slate-100">{data.items.map(message=><li key={message.id} className="flex flex-wrap justify-between gap-3 py-4 text-sm"><div><p>Communication {message.channel}</p><time className="text-xs text-slate-500" dateTime={message.created_at}>{date(message.created_at)}</time></div><span>{labels[message.status]||"État non reconnu"}</span></li>)}</ul>}{data.total_pages>1&&<Pages page={page} total={data.total_pages} change={setPage}/>}</>}</section>;
}

function Planning({item,close,saved}:{item:Overview;close:()=>void;saved:()=>void}){
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");const pending=useRef(false);
  function local(value:string|null){if(!value)return "";const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(pending.current)return;
    const form=new FormData(event.currentTarget);const planned=String(form.get("planned")||"");
    pending.current=true;setSaving(true);setError("");
    try{await api.patch(`/shipments/workspace/${item.id}/planning`,{expected_version:item.version,planned_departure_at:planned?new Date(planned).toISOString():null,reason:String(form.get("reason")||"").trim()});saved();}
    catch(cause){const detail=axios.isAxiosError(cause)?cause.response?.data?.detail:null;setError(detail==="stale_shipment_version"?"La fiche a changé. Fermez ce panneau et actualisez avant de reprendre.":detail==="shipment_planning_closed"?"Le départ a déjà été confirmé ou la préparation est clôturée.":"Confirmation non reçue. Vérifiez le planning avant de réessayer.");}
    finally{pending.current=false;setSaving(false);}}
  return <OperationDrawer open title="Modifier le départ prévu" placement="right" width="max-w-2xl" close={()=>{if(!pending.current)close();}}><form onSubmit={submit} className="grid gap-5"><p className="text-sm text-slate-500">Modification interne uniquement : aucun départ confirmé et aucun message envoyé.</p><fieldset disabled={saving} className="grid gap-4"><label className="grid gap-1.5 text-sm">Départ prévu<input className={field} name="planned" type="datetime-local" defaultValue={local(item.planned_departure_at)}/></label><p className="text-xs text-slate-500">Heure locale du navigateur. Effacez la date si elle n’est plus déterminée.</p><label className="grid gap-1.5 text-sm">Motif<input className={field} name="reason" required minLength={3} maxLength={500}/></label></fieldset>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><OperationButton onClick={close} disabled={saving}>Annuler</OperationButton><OperationButton type="submit" variant="primary" disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</OperationButton></div></form></OperationDrawer>;
}

function CancelShipment({item,close,saved}:{item:Overview;close:()=>void;saved:()=>void}){
  const [saving,setSaving]=useState(false);const [reason,setReason]=useState("");const [error,setError]=useState("");const pending=useRef(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(pending.current||reason.trim().length<3)return;pending.current=true;setSaving(true);setError("");
    try{await api.post(`/shipments/workspace/${item.id}/cancel`,{expected_version:item.version,reason:reason.trim()});saved();}
    catch(cause){const detail=axios.isAxiosError(cause)?cause.response?.data?.detail:null;setError(detail==="stale_shipment_version"?"L’expédition a changé. Actualisez la fiche avant de réessayer.":detail==="shipment_loading_closed"?"Le départ est confirmé : cette expédition ne peut plus être annulée depuis la préparation.":"Annulation non confirmée. Actualisez la fiche avant toute nouvelle tentative.");}
    finally{pending.current=false;setSaving(false);}}
  return <OperationDrawer open title="Annuler l’expédition" placement="right" width="max-w-xl" close={()=>{if(!pending.current)close();}}><form onSubmit={submit} className="grid gap-4"><p className="text-sm text-slate-600">L’expédition sera annulée et ses {item.packages_count} colis libérés pour rester disponibles dans leur bureau. Leur statut physique ne changera pas. Cette action est historisée.</p><label className="grid gap-1.5 text-sm">Motif de l’annulation<input className={field} value={reason} onChange={event=>setReason(event.target.value)} minLength={3} maxLength={500} required disabled={saving}/></label>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><OperationButton disabled={saving} onClick={close}>Retour</OperationButton><OperationButton type="submit" disabled={saving||reason.trim().length<3} className="text-red-700">{saving?"Annulation…":"Confirmer l’annulation"}</OperationButton></div></form></OperationDrawer>;
}
