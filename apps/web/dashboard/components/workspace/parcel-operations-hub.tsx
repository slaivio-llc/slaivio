"use client";

import { ArrowRight, Package, Route, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { departureStats, type DepartureStats } from "@/services/departures";
import { getPackageStats, type PackageStats } from "@/services/packages";
import { catalog } from "@/services/route-catalog";
import { getShipmentStats, type ExpeditionStats } from "@/services/shipments";
import { getWarehouseStats, type WarehouseStats } from "@/services/warehouses";

type Summary = {
  packages: PackageStats | null;
  departures: DepartureStats | null;
  shipments: ExpeditionStats | null;
  warehouses: WarehouseStats | null;
  routes: number;
  services: number;
};

const emptySummary:Summary={packages:null,departures:null,shipments:null,warehouses:null,routes:0,services:0};

export function ParcelOperationsHub(){
  const [summary,setSummary]=useState<Summary>(emptySummary);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;Promise.allSettled([getPackageStats(),departureStats(),getShipmentStats(),getWarehouseStats(),catalog()]).then(results=>{if(!active)return;setSummary({packages:results[0].status==="fulfilled"?results[0].value:null,departures:results[1].status==="fulfilled"?results[1].value:null,shipments:results[2].status==="fulfilled"?results[2].value:null,warehouses:results[3].status==="fulfilled"?results[3].value:null,routes:results[4].status==="fulfilled"?results[4].value.routes.length:0,services:results[4].status==="fulfilled"?results[4].value.services.length:0});setLoading(false);});return()=>{active=false};},[]);
  return <div className="min-h-full bg-white"><OperationPageHeader title="Opérations" description="Réceptionnez les colis, préparez les départs et suivez les expéditions depuis un seul espace."/><OperationContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <ModuleCard href="/app/packages" icon={<Package size={18}/>} title="Colis" value={summary.packages?.total} loading={loading} detail={`${summary.packages?.in_stock??0} en entrepôt · ${summary.packages?.issues??0} à vérifier`}/>
    <ModuleCard href="/app/departures" icon={<Truck size={18}/>} title="Départs et manifestes" value={summary.departures?.confirmed} loading={loading} suffix="confirmés" detail={`${summary.departures?.pending??0} à confirmer · ${summary.departures?.packages??0} colis affectés`}/>
    <ModuleCard href="/app/shipments" icon={<Truck size={18}/>} title="Expéditions" value={summary.shipments?.active} loading={loading} suffix="actives" detail={`${summary.shipments?.in_transit??0} en transit · ${summary.shipments?.delayed??0} en retard`}/>
    <ModuleCard href="/app/warehouses" icon={<Warehouse size={18}/>} title="Entrepôts" value={summary.warehouses?.warehouses} loading={loading} suffix="sites" detail={`${summary.warehouses?.packages??0} colis stockés · ${summary.warehouses?.anomalies??0} anomalies`}/>
    <ModuleCard href="/app/routes" icon={<Route size={18}/>} title="Routes et services" value={summary.routes} loading={loading} suffix="routes" detail={`${summary.services} services configurés avec tarifs et délais`}/>
  </OperationContent></div>;
}

function ModuleCard({href,icon,title,value,suffix="au total",detail,loading}:{href:string;icon:ReactNode;title:string;value?:number|null;suffix?:string;detail:string;loading:boolean}){
  return <Link href={href} className="group min-h-[144px] rounded-[9px] border border-[#dfe3e7] bg-white p-5 transition-colors hover:border-[#b9c6c0] hover:bg-[#fbfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ccdb8]">
    <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#eef6f2] text-[#16704b]">{icon}</span><ArrowRight size={16} className="text-[#9aa2a9] transition-transform group-hover:translate-x-0.5 group-hover:text-[#16704b]"/></div>
    <div className="mt-4 flex items-baseline gap-2"><strong className="text-[21px] font-semibold text-[#25292e]">{loading?"—":value??0}</strong><span className="text-[11px] text-[#7a838b]">{suffix}</span></div>
    <h2 className="mt-1 text-[14px] font-semibold text-[#30373d]">{title}</h2><p className="mt-1 text-[12px] leading-5 text-[#747e86]">{detail}</p>
  </Link>;
}
