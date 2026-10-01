"use client";

import {FormEvent, useEffect, useState} from "react";
import {PackageSearch, Search} from "lucide-react";
import {findPublicPackageTracking, type PublicPackageTracking} from "@/services/tracking";

const statusLabels:Record<string,string>={CUSTOMS:"En douane",CANCELLED:"Annulé",RETURNED:"Retourné",WAREHOUSE_PROCESSING:"En préparation",READY_FOR_DISPATCH:"Prêt au départ",CREATED:"Enregistré",RECEIVED:"Reçu",RECEIVED_AT_ORIGIN:"Reçu à l’origine",WAREHOUSED:"En entrepôt",READY_FOR_BATCH:"Prêt au départ",BATCHED:"Affecté à un départ",SHIPPED:"Expédié",IN_TRANSIT:"En transit",ARRIVED:"Arrivé",ARRIVED_DESTINATION:"Arrivé à destination",CLEARED:"Dédouané",READY_FOR_PICKUP:"Prêt au retrait",DELIVERED:"Livré",BLOCKED:"En attente de traitement",ISSUE:"Action requise"};

export default function PublicTrackingSearchPage(){
  const [reference,setReference]=useState("");
  const [tracking,setTracking]=useState<PublicPackageTracking|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  async function lookup(reference:string){if(reference.trim().length<6)return;setLoading(true);setError("");setTracking(null);try{setTracking(await findPublicPackageTracking(reference));}catch{setError("Aucun colis public ne correspond à ce numéro de suivi. Vérifiez le numéro auprès de l’agence.");}finally{setLoading(false)}}
  async function submit(event:FormEvent){event.preventDefault();await lookup(reference);}
  useEffect(()=>{const initial=new URLSearchParams(window.location.search).get("reference");if(initial){setReference(initial);void lookup(initial);}},[]);
  const agencyName=tracking?.agency_name || "Suivi colis";
  const agencyLogo=tracking?.agency_logo_url;
  return <main className="min-h-screen bg-white px-5 py-12 text-[#20272e] sm:py-20">
    <div className="mx-auto max-w-2xl">
      <header className="text-center">{agencyLogo && /^https:\/\//i.test(agencyLogo) ? <div role="img" aria-label={`Logo ${agencyName}`} className="mx-auto h-16 w-32 bg-contain bg-center bg-no-repeat" style={{backgroundImage:`url(${JSON.stringify(agencyLogo)})`}}/> : <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#eaf8f1] text-[#079456]"><PackageSearch size={24}/></div>}<p className="mt-5 text-[13px] font-semibold uppercase tracking-[.12em] text-[#079456]">{agencyName}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Suivre un colis</h1><p className="mx-auto mt-3 max-w-lg text-[14px] leading-6 text-[#69747d]">Saisissez le numéro communiqué par votre agence pour consulter l’état et l’historique de votre colis.</p></header>
      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl gap-2"><label className="flex h-12 flex-1 items-center rounded-lg border border-[#d8dee2] bg-white px-4 focus-within:border-[#12a865] focus-within:ring-2 focus-within:ring-[#12c76f]/10"><Search size={18} className="text-[#7a858e]"/><input value={reference} onChange={event=>setReference(event.target.value)} className="ml-3 min-w-0 flex-1 bg-transparent text-[14px] outline-none" placeholder="Ex. COL-2026-000123" aria-label="Numéro de suivi"/></label><button disabled={loading||reference.trim().length<6} className="h-12 rounded-lg bg-[#12c76f] px-5 text-[14px] font-semibold text-white disabled:opacity-50">{loading?"Recherche…":"Suivre"}</button></form>
      {error&&<p role="alert" className="mx-auto mt-5 max-w-xl rounded-lg bg-[#fff4f2] px-4 py-3 text-[13px] text-[#9b3d32]">{error}</p>}
      {tracking&&<section className="mt-8 overflow-hidden rounded-xl border border-[#dfe4e7] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5"><div><p className="text-[12px] text-[#77828b]">Numéro de suivi</p><h2 className="mt-1 text-xl font-semibold">{tracking.tracking_id||tracking.package_reference}</h2><p className="mt-2 text-[13px] text-[#68747d]">{[tracking.origin_city,tracking.origin_country].filter(Boolean).join(", ")||"Origine"} → {[tracking.destination_city,tracking.destination_country].filter(Boolean).join(", ")||"Destination"}</p></div><span className="rounded-full bg-[#eaf8f1] px-3 py-1.5 text-[12px] font-semibold text-[#087a48]">{statusLabels[tracking.status]||tracking.status}</span></div>
        <div className="grid border-y border-[#edf0f2] sm:grid-cols-3">{[["Dernière position",tracking.last_scan_location||"Non renseignée"],["Arrivée estimée",date(tracking.eta_at)],["Dernière mise à jour",date(tracking.updated_at)]].map(([label,value])=><div key={label} className="px-5 py-4 sm:border-r sm:border-[#edf0f2] sm:last:border-0"><p className="text-[11px] text-[#78838c]">{label}</p><p className="mt-1 text-[13px] font-medium">{value}</p></div>)}</div>
        <div className="p-5"><h3 className="text-[14px] font-semibold">Historique</h3><div className="mt-4 space-y-4">{tracking.events.length?tracking.events.map((item,index)=><article key={`${item.occurred_at}-${index}`} className="border-l-2 border-[#b7dec9] pl-4"><p className="text-[13px] font-medium">{item.new_status ? (statusLabels[item.new_status] || item.title) : item.title}</p>{item.description&&<p className="mt-1 text-[12px] text-[#69747d]">{item.description}</p>}<time className="mt-1 block text-[11px] text-[#89929a]">{date(item.occurred_at)}</time></article>):<p className="text-[13px] text-[#69747d]">Le premier événement de suivi apparaîtra bientôt.</p>}</div></div>
      </section>}
    </div>
  </main>;
}

function date(value:string|null){return value?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—"}
