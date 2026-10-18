"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationButton } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getShipmentDepartureCalendar, type ShipmentDepartureCalendarItem } from "@/services/shipments";

const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" });
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

export function DepartureCalendarPage() {
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [items,setItems]=useState<ShipmentDepartureCalendarItem[]>([]);
  const [selected,setSelected]=useState(dateKey(new Date()));
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [truncated,setTruncated]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try { const start=new Date(month.getFullYear(),month.getMonth(),1);const end=new Date(month.getFullYear(),month.getMonth()+1,1);const result=await getShipmentDepartureCalendar(start.toISOString(),end.toISOString());setItems(result.items);setTruncated(result.truncated); }
    catch { setError("Le calendrier des expéditions n’a pas pu être chargé."); }
    finally { setLoading(false); }
  },[month]);
  useEffect(()=>{void load();},[load]);
  const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;
  const counts=new Map<string,number>();for(const item of items){const key=dateKey(new Date(item.calendar_at));counts.set(key,(counts.get(key)||0)+1);}
  const selectedItems=items.filter(item=>dateKey(new Date(item.calendar_at))===selected);
  const plannedCount=items.filter(item=>!item.departed_at).length;
  const departedCount=items.length-plannedCount;
  const move=(delta:number)=>{const next=new Date(month.getFullYear(),month.getMonth()+delta,1);setMonth(next);setSelected(dateKey(next));};
  return <div className="min-h-full bg-white">
    <OperationPageHeader title="Calendrier des départs" description="Vue des départs prévus et réels des expéditions. La création et la confirmation restent dans Expéditions." actions={<><OperationButton onClick={()=>void load()} aria-label="Actualiser le calendrier"><RefreshCcw size={14}/>Actualiser</OperationButton><Link href="/app/shipments" className="inline-flex h-9 items-center rounded-md bg-[#12a865] px-3 text-[13px] font-medium text-white">Ouvrir les expéditions</Link></>}/>
    <main className="mx-auto grid w-full max-w-[1200px] gap-5 px-6 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
      <section className="grid gap-3 sm:col-span-2 sm:grid-cols-3" aria-label="Résumé du mois"><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">Expéditions avec un départ ce mois</p><p className="mt-1 text-xl font-semibold text-slate-800">{items.length}{truncated?"+":""}</p></div><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">Départs prévus</p><p className="mt-1 text-xl font-semibold text-slate-800">{plannedCount}</p></div><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">Départs confirmés</p><p className="mt-1 text-xl font-semibold text-slate-800">{departedCount}</p></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Calendrier mensuel des départs">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold capitalize text-slate-800">{monthLabel.format(month)}</h2><div className="flex gap-1"><OperationButton aria-label="Mois précédent" onClick={()=>move(-1)}><ChevronLeft size={16}/></OperationButton><OperationButton aria-label="Mois suivant" onClick={()=>move(1)}><ChevronRight size={16}/></OperationButton></div></div>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-500">{["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(day=><div key={day} className="py-2">{day}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">{Array.from({length:offset},(_,i)=><div key={`blank-${i}`} className="min-h-16 rounded-md bg-slate-50/50 sm:min-h-20"/>)}{Array.from({length:daysInMonth},(_,i)=>{const date=new Date(month.getFullYear(),month.getMonth(),i+1);const key=dateKey(date);const count=counts.get(key)||0;return <button key={key} type="button" onClick={()=>setSelected(key)} aria-pressed={selected===key} className={`min-h-16 rounded-md border p-2 text-left sm:min-h-20 ${selected===key?"border-emerald-500 bg-emerald-50":"border-slate-100 hover:border-slate-300"}`}><span className="text-xs font-medium text-slate-700">{i+1}</span>{count>0&&<span className="mt-2 block rounded bg-emerald-100 px-1.5 py-0.5 text-center text-[10px] font-medium text-emerald-800">{count} expédition{count===1?"":"s"}</span>}</button>;})}</div>
      </section>
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="mb-4 text-sm font-semibold text-slate-800">{dayLabel.format(new Date(`${selected}T12:00:00`))}</h2>
        {loading?<LoadingState label="Chargement du calendrier…"/>:error?<ErrorState title="Calendrier indisponible" description={error} retry={()=>void load()}/>:selectedItems.length===0?<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Aucun départ prévu ou confirmé pour cette journée.</p>:<ul className="divide-y divide-slate-100">{selectedItems.map(item=><li key={item.id} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.reference}</p><p className="mt-1 text-xs text-slate-600">{item.route_label||`${item.origin_city||item.origin_country||"Origine"} → ${item.destination_city||item.destination_country||"Destination"}`}</p><p className="mt-1 text-xs text-slate-500">{item.packages_count} colis · {new Intl.DateTimeFormat("fr-FR",{timeStyle:"short"}).format(new Date(item.calendar_at))}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${item.departed_at?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700"}`}>{item.departed_at?"Départ confirmé":"Prévu"}</span></div></li>)}</ul>}
        {truncated&&<p className="mt-3 text-xs text-amber-700">L’affichage est limité aux 500 premières expéditions de cette période.</p>}
      </section>
    </main>
  </div>;
}
