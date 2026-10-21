"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import axios from "axios";
import { api } from "@/services/api";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationButton, OperationFilterPopover } from "@/components/ui/operation-controls";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { operationInputClass as field } from "@/components/ui/operation-styles";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { TableSkeleton } from "@/components/ui/page-state";
import { getShipmentAnalytics, type ShipmentAnalytics } from "@/services/shipments";
import { FreightShipmentDetail } from "./freight-detail";

type Shipment = { id:string; reference:string; origin_city:string|null; origin_country:string|null;
  destination_city:string|null; destination_country:string|null; stage:string; status:string;
  packages_count:number; planned_departure_at:string|null; departed_at:string|null };
type Result = { items:Shipment[]; page:number; total:number; total_pages:number };
type Route = { id:string; route_name:string; origin_city:string|null; origin_country:string;
  destination_city:string|null; destination_country:string; transport_mode:string;
  services:Array<{id:string;name:string;mode:string}> };
const stages:Record<string,string> = { planned:"Prévue", departed:"Partie", arrived:"Arrivée", other:"Autre état" };
function location(city:string|null,country:string|null) { return [city,country].filter(Boolean).join(", ") || "Non renseigné"; }
function todayLocal(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;}
function departure(item:Shipment) {
  const value=item.departed_at||item.planned_departure_at;
  return value ? `${item.departed_at?"Réel":"Prévu"} · ${new Intl.DateTimeFormat("fr",{dateStyle:"medium"}).format(new Date(value))}` : "Date à définir";
}

export function FreightShipmentRegister({embedded=false}:{embedded?:boolean}) {
  const [result,setResult]=useState<Result|null>(null);
  const [q,setQ]=useState("");const [stage,setStage]=useState("");const [page,setPage]=useState(1);
  const [start,setStart]=useState("");const [end,setEnd]=useState("");
  const [origin,setOrigin]=useState("");const [destination,setDestination]=useState("");
  const [locations,setLocations]=useState<{origins:string[];destinations:string[]}>({origins:[],destinations:[]});
  useEffect(()=>{const controller=new AbortController();api.get('/shipments/register/locations',{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setLocations({origins:r.data.origins||[],destinations:r.data.destinations||[]});}).catch(()=>undefined);return()=>controller.abort();},[]);
  const [revision,setRevision]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState(false);
  const [creating,setCreating]=useState(false);const [created,setCreated]=useState<{id:string;reference:string}|null>(null);
  const [selectedShipment,setSelectedShipment]=useState<string|null>(null);
  const [analytics,setAnalytics]=useState<ShipmentAnalytics|null>(null);const [analyticsError,setAnalyticsError]=useState(false);
  useEffect(()=>{if(!embedded)return;let active=true;getShipmentAnalytics().then(value=>{if(active){setAnalytics(value);setAnalyticsError(false)}}).catch(()=>{if(active)setAnalyticsError(true)});return()=>{active=false}},[embedded,revision]);
  const invalid=Boolean(start&&end&&start>end);
  const incomplete=Boolean(start)!==Boolean(end);
  useEffect(()=>{
    if(invalid||incomplete)return;
    const controller=new AbortController();setLoading(true);setError(false);
    const timer=setTimeout(()=>{
      api.get<Result>("/shipments/register",{params:{q,stage:stage||undefined,start:start||undefined,end:end||undefined,page,origin:origin||undefined,destination:destination||undefined},signal:controller.signal})
        .then(response=>{if(!controller.signal.aborted)setResult(response.data);})
        .catch(()=>{if(!controller.signal.aborted)setError(true);})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },220);
    return()=>{clearTimeout(timer);controller.abort();};
  },[q,stage,start,end,page,revision,invalid,incomplete,origin,destination]);
  function reset(){setQ("");setStage("");setStart("");setEnd("");setOrigin("");setDestination("");setPage(1);}
  const filtered=Boolean(q||stage||start||end||origin||destination);
  function reference(item:Shipment){return embedded?<button type="button" className="font-medium text-emerald-800 hover:underline" onClick={()=>setSelectedShipment(item.id)}>{item.reference}</button>:<Link className="font-medium text-emerald-800 hover:underline" href={`/app/shipments/${encodeURIComponent(item.id)}`}>{item.reference}</Link>;}
  function state(item:Shipment){const label=embedded&&item.stage==="departed"?"En transit":stages[item.stage]||"Autre état";const tone=item.stage==="arrived"?"bg-emerald-50 text-emerald-800":embedded&&item.stage==="departed"?"bg-sky-50 text-sky-700":"bg-slate-100 text-slate-700";return <span title={item.stage==="other"?item.status:undefined} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;}
  const countStages=(accepted:string[])=>analytics?.by_status.filter(item=>accepted.includes(item.label)).reduce((sum,item)=>sum+item.count,0);
  const statusTabs=[["","Toutes"],["planned","Prévues"],["departed","En transit"],["arrived","Arrivées"]];
  return <div className={`min-h-full bg-white ${embedded?"py-2":""}`}>
    {!embedded&&<OperationPageHeader title="Expéditions" description="Préparez le chargement et suivez chaque mouvement." backHref="/app/shipments" backLabel="Retour aux opérations"
      actions={<PermissionGuard permission="shipments.create"><OperationButton variant="primary" onClick={()=>setCreating(true)}><Plus size={15}/>Nouvelle expédition</OperationButton></PermissionGuard>}/>}
    <section className={`mx-auto w-full pb-8 ${embedded?"max-w-full px-0":"max-w-[1200px] px-6 sm:px-8"}`} aria-label="Registre des expéditions">
      {created&&<p role="status" className="mb-4 text-sm text-emerald-800">{created.reference} créée. {embedded?<button type="button" className="underline" onClick={()=>setSelectedShipment(created.id)}>Ouvrir l’expédition</button>:<Link className="underline" href={`/app/shipments/${created.id}`}>Ouvrir l’expédition</Link>}</p>}
      <div>
        {embedded&&<div className="grid grid-cols-4 gap-2 py-3" aria-label="Indicateurs expéditions">{[["Total",analytics?.summary.total],["Prévues",countStages(["DRAFT","PREPARING","LOADING","READY_FOR_DEPARTURE"])],["En transit",countStages(["DISPATCHED","IN_TRANSIT"])],["Arrivées",countStages(["ARRIVED_DESTINATION","CUSTOMS_CLEARANCE","AVAILABLE_FOR_PICKUP","OUT_FOR_DELIVERY","DELIVERED"]) ]].map(([label,value])=><div key={String(label)} className="min-w-0"><span className="block truncate text-[10px] text-slate-500">{label}</span><strong className="mt-1 block text-sm font-semibold text-slate-900">{analyticsError?"—":value??"—"}</strong></div>)}</div>}
        <div className={`flex flex-wrap items-center gap-2 ${embedded?"py-2":"p-4"}`}>
          <label className={`relative ${embedded?"w-full sm:flex-1":"mr-auto w-full sm:max-w-xs"}`}><Search size={15} aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/><input aria-label="Rechercher une expédition" type="search" maxLength={120} placeholder={embedded?"Rechercher une expédition, une route…":"Référence d’expédition…"} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} className={`${field} pl-9`}/></label>
          {embedded&&<PermissionGuard permission="shipments.create"><OperationButton variant="primary" onClick={()=>setCreating(true)}><Plus size={14}/>Nouvelle expédition</OperationButton></PermissionGuard>}
          {!embedded&&<>
          <OperationFilterPopover title="Filtrer les expéditions" activeCount={Number(Boolean(stage))+Number(Boolean(start||end))+Number(Boolean(origin))+Number(Boolean(destination))} onReset={reset}>
            {locations.origins.length>1&&<label className="grid gap-1.5 text-xs">Origine<select className={field} value={origin} onChange={e=>{setOrigin(e.target.value);setPage(1);}}><option value="">Toutes les origines</option>{locations.origins.map(value=><option key={value}>{value}</option>)}</select></label>}
            {locations.destinations.length>1&&<label className="grid gap-1.5 text-xs">Destination<select className={field} value={destination} onChange={e=>{setDestination(e.target.value);setPage(1);}}><option value="">Toutes les destinations</option>{locations.destinations.map(value=><option key={value}>{value}</option>)}</select></label>}
            <label className="grid gap-1.5 text-xs">État<select value={stage} className={field} onChange={e=>{setStage(e.target.value);setPage(1);}}><option value="">Tous les états</option>{Object.entries(stages).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs">Créée à partir du (UTC)<input type="date" value={start} className={field} onChange={e=>{setStart(e.target.value);setPage(1);}}/></label>
            <label className="grid gap-1.5 text-xs">Jusqu’au (UTC)<input type="date" value={end} min={start||undefined} className={field} onChange={e=>{setEnd(e.target.value);setPage(1);}}/></label>
          </OperationFilterPopover>
          <OperationButton className="w-9 px-0" aria-label="Actualiser les expéditions" disabled={loading&&!invalid&&!incomplete} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15}/></OperationButton>
          </>}
        </div>
        {embedded&&<nav aria-label="Filtrer les expéditions par statut" className="flex flex-wrap gap-1 py-2">{statusTabs.map(([key,label])=><button key={key} type="button" aria-pressed={stage===key} onClick={()=>{setStage(key);setPage(1)}} className={`rounded-full px-2.5 py-1 text-[11px] ${stage===key?"bg-slate-100 font-semibold text-slate-900":"text-slate-500 hover:bg-slate-50"}`}>{label}</button>)}</nav>}
        {invalid||incomplete?<p role="alert" className="p-5 text-sm">{invalid?"La date de fin doit suivre celle du début.":"Choisissez les deux dates pour appliquer la période."}</p>:error?<div role="alert" className="p-5 text-sm">Impossible de charger les expéditions. <button className="underline" onClick={()=>setRevision(n=>n+1)}>Réessayer</button></div>:loading?<TableSkeleton rows={6} columns={4}/>:!result?.items.length?<div className="p-12 text-center text-sm"><p>{filtered?"Aucune expédition correspondante":"Aucune expédition enregistrée"}</p>{filtered&&<OperationButton className="mt-3" onClick={reset}>Effacer les filtres</OperationButton>}</div>:embedded?<>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="text-[10px] text-slate-500"><tr>{["Référence","Route / Service","Colis","Statut",""].map((label,index)=><th scope="col" key={`${label}-${index}`} className="border-b border-slate-100 px-2 py-2 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{result.items.map(item=><tr key={item.id} className="hover:bg-slate-50/70"><td className="px-2 py-2.5">{reference(item)}<span className="mt-0.5 block text-[9px] text-slate-500">{departure(item)}</span></td><td className="px-2 py-2.5 text-slate-700">{location(item.origin_city,item.origin_country)}<span className="mx-1 text-slate-400">→</span>{location(item.destination_city,item.destination_country)}</td><td className="px-2 py-2.5 text-slate-600">{item.packages_count}</td><td className="px-2 py-2.5">{state(item)}</td><td className="px-2 py-2.5 text-right">{embedded?<button type="button" onClick={()=>setSelectedShipment(item.id)} aria-label={`Ouvrir la fiche ${item.reference}`} className="inline-grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100"><MoreHorizontal size={15}/></button>:<Link href={`/app/shipments/${encodeURIComponent(item.id)}`} aria-label={`Ouvrir la fiche ${item.reference}`} className="inline-grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100"><MoreHorizontal size={15}/></Link>}</td></tr>)}</tbody></table></div>
          <div className="flex items-center gap-2 px-3 py-3 text-[10px] text-slate-500"><span className="mr-auto">{result.total} expédition(s)</span><OperationButton aria-label="Page précédente" className="h-8 w-8 px-0" disabled={page===1} onClick={()=>setPage(n=>n-1)}><ChevronLeft size={14}/></OperationButton><span>{page}/{result.total_pages}</span><OperationButton aria-label="Page suivante" className="h-8 w-8 px-0" disabled={page>=result.total_pages} onClick={()=>setPage(n=>n+1)}><ChevronRight size={14}/></OperationButton></div>
        </>:<>
          <div className="hidden md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Référence","Trajet","État","Départ"].map(label=><th scope="col" key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{result.items.map(item=><tr key={item.id} className="hover:bg-slate-50/60"><td className="px-5 py-4">{reference(item)}<p className="mt-1 text-xs text-slate-500">{item.packages_count} colis</p></td><td className="px-5 py-4">{location(item.origin_city,item.origin_country)}<span className="block text-slate-500">→ {location(item.destination_city,item.destination_country)}</span></td><td className="px-5 py-4">{state(item)}</td><td className="px-5 py-4 text-slate-600">{departure(item)}</td></tr>)}</tbody></table></div>
          <ul className="divide-y divide-slate-100 md:hidden">{result.items.map(item=><li key={item.id} className="grid gap-3 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2">{reference(item)}{state(item)}</div><p>{location(item.origin_city,item.origin_country)} → {location(item.destination_city,item.destination_country)}</p><p className="text-xs text-slate-500">{item.packages_count} colis · {departure(item)}</p></li>)}</ul>
          <div className="flex items-center gap-2 p-4 text-xs text-slate-500"><span className="mr-auto">{result.total} expédition(s) · Page {page}/{result.total_pages}</span><OperationButton aria-label="Page précédente" className="w-9 px-0" disabled={page===1} onClick={()=>setPage(n=>n-1)}><ChevronLeft size={15}/></OperationButton><OperationButton aria-label="Page suivante" className="w-9 px-0" disabled={page>=result.total_pages} onClick={()=>setPage(n=>n+1)}><ChevronRight size={15}/></OperationButton></div>
        </>}
      </div>
      {!embedded&&<PermissionGuard permission="departures.read"><Link href="/app/departures" className="mt-5 inline-block text-xs text-slate-500 underline">Consulter les anciennes planifications de départ</Link></PermissionGuard>}
    </section>
    {creating&&<ShipmentCreation close={()=>setCreating(false)} created={value=>{setCreated(value);setCreating(false);reset();setRevision(n=>n+1);}}/>}
    {selectedShipment&&<FreightShipmentDetail shipmentId={selectedShipment} onClose={()=>{setSelectedShipment(null);setRevision(value=>value+1);}}/>}
  </div>;
}

export function ShipmentCreation({close,created}:{close:()=>void;created:(item:{id:string;reference:string})=>void}) {
  const [routes,setRoutes]=useState<Route[]|null>(null);const [loadError,setLoadError]=useState(false);const [retry,setRetry]=useState(0);
  const [origin,setOrigin]=useState("");const [routeId,setRouteId]=useState("");const [serviceId,setServiceId]=useState("");
  const [plannedDate,setPlannedDate]=useState(todayLocal);const [plannedTime,setPlannedTime]=useState("10:00");const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");const [frozen,setFrozen]=useState(false);
  const pending=useRef(false);const key=useRef<string|null>(null);
  useEffect(()=>{const controller=new AbortController();setLoadError(false);
    api.get<{items:Route[]}>("/shipments/register/routes",{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setRoutes(r.data.items);}).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});
    return()=>controller.abort();},[retry]);
  const originKey=(route:Route)=>JSON.stringify([route.origin_country,route.origin_city]);
  const origins=Array.from(new Map((routes||[]).map(route=>[originKey(route),location(route.origin_city,route.origin_country)])).entries());
  const available=(routes||[]).filter(route=>originKey(route)===origin);
  const selectedRoute=available.find(route=>route.id===routeId);const services=selectedRoute?.services||[];
  function reset(){if(frozen)return;setOrigin("");setRouteId("");setServiceId("");setPlannedDate(todayLocal());setPlannedTime("10:00");setNotes("");setError("");key.current=null;}
  async function submit(event:FormEvent){
    event.preventDefault();if(pending.current||!routeId||!serviceId||!plannedDate)return;
    pending.current=true;setSaving(true);setFrozen(true);setError("");key.current??=crypto.randomUUID();
    const localDateTime=`${plannedDate}T${plannedTime||"10:00"}:00`;
    try{const response=await api.post<{id:string;reference:string}>("/shipments/register",{route_id:routeId,shipping_service_id:serviceId,notes:notes.trim()||null,request_key:key.current,planned_departure_at:new Date(localDateTime).toISOString()});created(response.data);}
    catch(cause){const status=axios.isAxiosError(cause)?cause.response?.status:null;
      if(status===409||status===422){setFrozen(false);setError("La route ou la demande n’est plus valide. Vérifiez votre sélection.");}
      else setError("Confirmation non reçue. Réessayez ici avec la même demande avant de créer une autre expédition.");
    }finally{pending.current=false;setSaving(false);}
  }
  return <OperationDrawer open title="Planifier un départ" description="Programmer une prochaine expédition" placement="center" width="max-w-xl" close={()=>{if(!pending.current)close();}}>
    {loadError?<p role="alert">Routes indisponibles. <button className="underline" onClick={()=>setRetry(n=>n+1)}>Réessayer</button></p>:!routes?<TableSkeleton rows={3} columns={1}/>:!routes.length?<p className="text-sm">Configurez une route active dans Routes et services avant de planifier un départ.</p>:<form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={saving||frozen} className="grid gap-3">
        <label className="grid gap-1.5 text-xs font-medium text-slate-700"><span>Origine <span aria-hidden="true" className="text-red-600">*</span></span><select required className={field} value={origin} onChange={e=>{setOrigin(e.target.value);setRouteId("");}}><option value="">Choisir l’origine</option>{origins.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-700"><span>Destination <span aria-hidden="true" className="text-red-600">*</span></span><select required disabled={!origin||saving||frozen} className={field} value={routeId} onChange={e=>{setRouteId(e.target.value);setServiceId("");}}><option value="">Choisir la destination</option>{available.map(route=><option key={route.id} value={route.id}>{location(route.destination_city,route.destination_country)} · {route.route_name}</option>)}</select></label>
        <fieldset disabled={!selectedRoute||saving||frozen} className="grid gap-2"><legend className="text-xs font-medium text-slate-700">Service <span aria-hidden="true" className="text-red-600">*</span></legend>{services.length?<div className="flex flex-wrap gap-x-5 gap-y-2">{services.map(service=><label key={service.id} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="shipping-service" required checked={serviceId===service.id} onChange={()=>setServiceId(service.id)} className="accent-slate-900"/>{service.name}</label>)}</div>:<p className="text-xs text-amber-800">Aucun service actif n’est configuré pour cette route.</p>}</fieldset>
        <label className="grid gap-1.5 text-xs font-medium text-slate-700"><span>Date prévue du départ <span aria-hidden="true" className="text-red-600">*</span></span><input required type="date" className={field} value={plannedDate} onChange={e=>setPlannedDate(e.target.value)}/></label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-700">Heure prévue (facultative)<input type="time" className={field} value={plannedTime} onChange={e=>setPlannedTime(e.target.value)}/></label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-700">Note interne (facultative)<textarea maxLength={1000} className={field} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Informations utiles pour l’équipe…"/></label>
        <div className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs"><span aria-hidden="true" className="mt-0.5 text-slate-500">ⓘ</span><div><p className="font-medium text-slate-800">Départ planifié</p><p className="mt-1 text-slate-600">Une expédition sera créée avec le statut « Prévue ». Vous pourrez ensuite y ajouter des colis.</p></div></div>
      </fieldset>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><OperationButton disabled={saving||frozen} onClick={reset}>Réinitialiser</OperationButton><OperationButton type="submit" variant="primary" disabled={saving||!routeId||!serviceId||!plannedDate}>{saving?"Création…":frozen?"Réessayer la confirmation":"Planifier le départ"}</OperationButton></div>
    </form>}
  </OperationDrawer>;
}
