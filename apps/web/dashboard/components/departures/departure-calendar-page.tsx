"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { OperationButton } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { ShipmentCreation } from "@/components/shipments/freight-register";
import { FreightShipmentDetail } from "@/components/shipments/freight-detail";
import { getShipmentDepartureCalendar, type ShipmentDepartureCalendarItem } from "@/services/shipments";

const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const routeLabel=(item:ShipmentDepartureCalendarItem)=>item.route_label||`${item.origin_city||item.origin_country||"Origine"} → ${item.destination_city||item.destination_country||"Destination"}`;

export function DepartureCalendarPage({ embedded = false }: { embedded?: boolean }) {
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [items,setItems]=useState<ShipmentDepartureCalendarItem[]>([]);
  const [selected,setSelected]=useState(dateKey(new Date()));
  const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [truncated,setTruncated]=useState(false);
  const [planning,setPlanning]=useState(false);
  const [created,setCreated]=useState<{id:string;reference:string}|null>(null);
  const [selectedShipment,setSelectedShipment]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {const start=new Date(month.getFullYear(),month.getMonth(),1);const end=new Date(month.getFullYear(),month.getMonth()+1,1);const result=await getShipmentDepartureCalendar(start.toISOString(),end.toISOString());setItems(result.items);setTruncated(result.truncated);}
    catch {setError("Le calendrier des expéditions n’a pas pu être chargé.");}
    finally {setLoading(false);}
  },[month]);
  useEffect(()=>{void load();},[load]);
  const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;
  const counts=new Map<string,number>();for(const item of items){const key=dateKey(new Date(item.calendar_at));counts.set(key,(counts.get(key)||0)+1);}
  const selectedItems=items.filter(item=>dateKey(new Date(item.calendar_at))===selected);
  const move=(delta:number)=>{const next=new Date(month.getFullYear(),month.getMonth()+delta,1);setMonth(next);setSelected(dateKey(next));};
  return <div className="min-h-full bg-white">
    <div className={embedded ? "w-full pb-10" : "mx-auto w-full max-w-[1200px] px-4 pb-10 sm:px-8"}>
      {created&&<p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Départ planifié : <button type="button" className="font-medium underline" onClick={()=>setSelectedShipment(created.id)}>{created.reference}</button>. L’expédition est en préparation; aucun colis n’est encore parti.</p>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><OperationButton aria-label="Mois précédent" onClick={()=>move(-1)}><ChevronLeft size={16}/></OperationButton><h2 className="min-w-32 text-sm font-semibold capitalize text-slate-800">{monthLabel.format(month)}</h2><OperationButton aria-label="Mois suivant" onClick={()=>move(1)}><ChevronRight size={16}/></OperationButton></div><div className="flex items-center gap-2"><PermissionGuard permission="shipments.create"><OperationButton variant="primary" onClick={()=>setPlanning(true)}><Plus size={14}/>Planifier</OperationButton></PermissionGuard><OperationButton onClick={()=>void load()} aria-label="Actualiser le calendrier"><RefreshCcw size={14}/>Actualiser</OperationButton></div></div>
      {loading&&<LoadingState label="Chargement du calendrier…"/>}{!loading&&error&&<ErrorState title="Calendrier indisponible" description={error} retry={()=>void load()}/>}
      {!loading&&!error&&<>
        <section className="bg-white" aria-label="Calendrier mensuel des départs">
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-500">{["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(day=><div key={day} className="py-2">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">{Array.from({length:offset},(_,i)=><div key={`blank-${i}`} className="min-h-12 rounded-md bg-slate-50/50 sm:min-h-14"/>)}{Array.from({length:daysInMonth},(_,i)=>{const date=new Date(month.getFullYear(),month.getMonth(),i+1);const key=dateKey(date);const count=counts.get(key)||0;return <button key={key} type="button" onClick={()=>setSelected(key)} aria-pressed={selected===key} className={`min-h-12 rounded-md border p-1.5 text-center sm:min-h-14 ${selected===key?"border-emerald-500 bg-emerald-50":"border-slate-100 bg-slate-50 hover:border-slate-300"}`}><span className="text-xs font-medium text-slate-700">{i+1}</span>{count>0&&<span className="mt-1 block text-[9px] font-semibold text-emerald-700">● {count}</span>}</button>;})}</div>
        </section>
        <section className="mt-4 border-t border-slate-100 pt-4"><h2 className="mb-3 text-sm font-semibold text-slate-800">Départs du {new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long"}).format(new Date(`${selected}T12:00:00`))}</h2>{selectedItems.length===0?<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Aucun départ prévu ou confirmé pour cette journée.</p>:<ul className="divide-y divide-slate-100">{selectedItems.map(item=><li key={item.id}><button type="button" onClick={()=>setSelectedShipment(item.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{routeLabel(item)}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{item.reference} · {item.packages_count} colis</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${item.departed_at?"bg-blue-50 text-blue-700":"bg-slate-100 text-slate-700"}`}>{item.departed_at?"Départ confirmé":"Prévu"}</span></button></li>)}</ul>}</section>
      </>}
      {truncated&&<p className="mt-3 text-xs text-amber-700">L’affichage est limité aux 500 premières expéditions de cette période.</p>}
    </div>
    {planning&&<ShipmentCreation close={()=>setPlanning(false)} created={item=>{setPlanning(false);setCreated(item);void load();}}/>}
    {selectedShipment&&<FreightShipmentDetail shipmentId={selectedShipment} onClose={()=>setSelectedShipment(null)}/>}
  </div>;
}
