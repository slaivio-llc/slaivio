"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import { CalendarClock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationButton } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { TableSkeleton } from "@/components/ui/page-state";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { FreightWorkflow, FreightManifest, RemoveFreightParcel } from "./freight-workflow";

type Overview={id:string;reference:string;stage:string;status:string;version:number;workflow_version?:number;origin_city:string|null;origin_country:string|null;destination_city:string|null;destination_country:string|null;route_label:string|null;planned_departure_at:string|null;departed_at:string|null;arrived_at:string|null;packages_count:number;weighed_count:number;known_weight_kg:number|null;is_delayed:boolean;delay_reason:string|null};
type Parcel={id:string;reference:string;client_name:string|null;supplier_tracking:string|null;weight_kg:number|null;destination_city:string|null;destination_country:string|null};
type Event={id:string;title:string;description:string|null;created_at:string;event_type:string;previous_planned_at:string|null;next_planned_at:string|null};
type Communication={id:string;notification_type:string;channel:string;status:string;created_at:string;sent_at:string|null;failed_at:string|null};
type Page<T>={items:T[];page:number;total_pages:number;total?:number};
const stageLabels:Record<string,string>={planned:"Prévue",departed:"Partie",arrived:"Arrivée",other:"Autre état"};
const tabLabels={overview:"Aperçu",packages:"Colis",communications:"Communications",manifest:"Manifeste"};
type Tab=keyof typeof tabLabels;
function date(value:string|null){return value?new Intl.DateTimeFormat("fr",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"Non renseigné";}
function location(city:string|null,country:string|null){return [city,country].filter(Boolean).join(", ")||"Non renseigné";}
function useResource<T>(url:string,revision:number){
  const [data,setData]=useState<T|null>(null);const [error,setError]=useState(false);
  useEffect(()=>{const controller=new AbortController();setData(null);setError(false);
    api.get<T>(url,{signal:controller.signal}).then(response=>{if(!controller.signal.aborted)setData(response.data);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();},[url,revision]);
  return {data,error};
}
function Pages({page,total,change}:{page:number;total:number;change:(page:number)=>void}){return <div className="mt-5 flex justify-end gap-2"><OperationButton className="w-9 px-0" aria-label="Page précédente" disabled={page===1} onClick={()=>change(page-1)}><ChevronLeft size={15}/></OperationButton><span className="self-center text-xs text-slate-500">{page} / {Math.max(1,total)}</span><OperationButton className="w-9 px-0" aria-label="Page suivante" disabled={page>=total} onClick={()=>change(page+1)}><ChevronRight size={15}/></OperationButton></div>;}

export function FreightShipmentDetail({shipmentId}:{shipmentId:string}){
  const [revision,setRevision]=useState(0);const [tab,setTab]=useState<Tab>("overview");const [planning,setPlanning]=useState(false);
  const {data:item,error}=useResource<Overview>(`/shipments/workspace/${encodeURIComponent(shipmentId)}`,revision);
  const refresh=()=>setRevision(value=>value+1);
  return <div className="min-h-full bg-white">
    <OperationPageHeader title={item?.reference||"Expédition"} description={item?`${location(item.origin_city,item.origin_country)} → ${location(item.destination_city,item.destination_country)}`:"Préparation et suivi du mouvement."} backHref="/app/shipments" backLabel="Retour aux expéditions"
      actions={<><OperationButton className="w-9 px-0" aria-label="Actualiser l’expédition" onClick={refresh}><RefreshCw size={15}/></OperationButton>{item?.stage==="planned"&&<PermissionGuard permission="shipments.update"><OperationButton onClick={()=>setPlanning(true)}><CalendarClock size={15}/>Modifier le planning</OperationButton></PermissionGuard>}</>}/>
    <div className="mx-auto max-w-[1200px] px-6 pb-8 sm:px-8">
      {error?<p role="alert" className="text-sm">Expédition indisponible ou accès non autorisé. <button className="underline" onClick={refresh}>Réessayer</button></p>:!item?<TableSkeleton rows={5} columns={2}/>:<>
        <div className="mb-5 flex flex-wrap items-center gap-3 text-sm"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{stageLabels[item.stage]||"Autre état"}</span><span className="text-slate-500">{item.packages_count} colis</span>{item.is_delayed&&<span className="text-amber-800">Retard signalé</span>}</div>
        <FreightWorkflow item={item} saved={refresh}/>
        <nav aria-label="Sections de l’expédition" className="mb-6 flex gap-5 overflow-x-auto">{Object.entries(tabLabels).map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key as Tab)} className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium ${tab===key?"border-emerald-700 text-emerald-800":"border-transparent text-slate-500"}`}>{label}</button>)}</nav>
        {tab==="overview"?<><dl className="grid gap-6 rounded-xl border border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-3">{[["Route",item.route_label||"Non renseignée"],["Départ prévu",date(item.planned_departure_at)],["Départ réel",date(item.departed_at)],["Arrivée réelle",date(item.arrived_at)],["Poids renseigné",item.known_weight_kg==null?"Aucun poids renseigné":`${new Intl.NumberFormat("fr").format(item.known_weight_kg)} kg`],["Couverture de pesée",`${item.weighed_count} / ${item.packages_count} colis`]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 break-words text-sm">{value}</dd></div>)}</dl>{item.is_delayed&&item.delay_reason&&<p className="mt-4 text-sm text-amber-800">{item.delay_reason}</p>}<History shipmentId={shipmentId} revision={revision}/></>:tab==="communications"?<Communications shipmentId={shipmentId} revision={revision}/>:<Cargo key={`${shipmentId}:${tab}`} shipmentId={shipmentId} revision={revision} manifest={tab==="manifest"} item={item} saved={refresh}/>}
        {planning&&<Planning item={item} close={()=>setPlanning(false)} saved={()=>{setPlanning(false);refresh();}}/>}
      </>}
    </div>
  </div>;
}

function History({shipmentId,revision}:{shipmentId:string;revision:number}){
  const [page,setPage]=useState(1);const {data,error}=useResource<Page<Event>>(`/shipments/workspace/${encodeURIComponent(shipmentId)}/history?page=${page}`,revision);
  return <section className="mt-8" aria-label="Historique opérationnel"><h2 className="mb-5 text-sm font-semibold">Historique opérationnel</h2>{error?<p role="alert">Historique indisponible. Actualisez la fiche.</p>:!data?<TableSkeleton rows={3} columns={1}/>:<><ol className="space-y-5">{data.items.map(event=><li key={event.id} className="border-l-2 border-slate-200 pl-4"><p className="text-sm font-medium">{event.title}</p><time className="text-xs text-slate-500" dateTime={event.created_at}>{date(event.created_at)}</time>{event.event_type==="SHIPMENT_PLANNING_CHANGED"&&<p className="mt-2 text-xs text-slate-500">{date(event.previous_planned_at)} → {date(event.next_planned_at)}</p>}{event.description&&<p className="mt-2 text-sm text-slate-600">{event.description}</p>}</li>)}</ol>{!data.items.length&&<p className="text-sm text-slate-500">Aucun événement opérationnel enregistré.</p>}{data.total_pages>1&&<Pages page={page} total={data.total_pages} change={setPage}/>}</>}</section>;
}

function Cargo({shipmentId,revision,manifest,item,saved}:{shipmentId:string;revision:number;manifest:boolean;item:Overview;saved:()=>void}){
  if(manifest)return <FreightManifest shipmentId={shipmentId} revision={revision}/>;
  return <AssignedCargo shipmentId={shipmentId} revision={revision} item={item} saved={saved}/>;
}

function AssignedCargo({shipmentId,revision,item,saved}:{shipmentId:string;revision:number;item:Overview;saved:()=>void}){
  const [q,setQ]=useState("");const [query,setQuery]=useState("");const [page,setPage]=useState(1);
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(q);setPage(1);},220);return()=>clearTimeout(timer);},[q]);
  const {data,error}=useResource<Page<Parcel>>(`/shipments/workspace/${encodeURIComponent(shipmentId)}/packages?q=${encodeURIComponent(query)}&page=${page}`,revision);
  return <section aria-label="Colis affectés">
    <input type="search" aria-label="Rechercher dans les colis affectés" placeholder="Référence, client ou tracking…" maxLength={120} value={q} onChange={event=>setQ(event.target.value)} className={`${field} mb-4 sm:max-w-sm`}/>
    {error?<p role="alert">Colis indisponibles. Actualisez la fiche.</p>:!data?<TableSkeleton rows={5} columns={4}/>:<>
      {!data.items.length?<p className="py-8 text-sm text-slate-500">{query?"Aucun colis correspondant.":"Aucun colis affecté à cette expédition."}</p>:<><div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Colis","Client","Tracking fournisseur","Poids","Destination"].map(label=><th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.items.map(parcel=><tr key={parcel.id}><td className="px-4 py-4"><Link className="text-emerald-800 hover:underline" href={`/app/packages?open=${parcel.id}`}>{parcel.reference}</Link><div><RemoveFreightParcel item={item} parcelId={parcel.id} saved={saved}/></div></td><td className="px-4 py-4">{parcel.client_name||"Non renseigné"}</td><td className="px-4 py-4">{parcel.supplier_tracking||"—"}</td><td className="px-4 py-4">{parcel.weight_kg==null?"Non pesé":`${parcel.weight_kg} kg`}</td><td className="px-4 py-4">{location(parcel.destination_city,parcel.destination_country)}</td></tr>)}</tbody></table></div><ul className="divide-y divide-slate-100 md:hidden">{data.items.map(parcel=><li key={parcel.id} className="grid gap-2 py-4 text-sm"><Link className="font-medium text-emerald-800" href={`/app/packages?open=${parcel.id}`}>{parcel.reference}</Link><span>{parcel.client_name||"Client non renseigné"}</span><span className="text-slate-500">{parcel.weight_kg==null?"Non pesé":`${parcel.weight_kg} kg`} · {location(parcel.destination_city,parcel.destination_country)}</span><RemoveFreightParcel item={item} parcelId={parcel.id} saved={saved}/></li>)}</ul></>}
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
