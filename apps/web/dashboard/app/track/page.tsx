"use client";

import {FormEvent, useCallback, useEffect, useRef, useState} from "react";
import {PackageSearch, Search} from "lucide-react";
import {findPublicPackageTracking,findPublicAgency,type PublicAgencyProfile} from "@/services/tracking";

const statusLabels:Record<string,string>={CUSTOMS:"En douane",CANCELLED:"Annulé",RETURNED:"Retourné",WAREHOUSE_PROCESSING:"En préparation",READY_FOR_DISPATCH:"Prêt au départ",CREATED:"Enregistré",RECEIVED:"Reçu",RECEIVED_AT_ORIGIN:"Reçu à l’origine",WAREHOUSED:"En entrepôt",READY_FOR_BATCH:"Prêt au départ",BATCHED:"Affecté à un départ",SHIPPED:"Expédié",IN_TRANSIT:"En transit",ARRIVED:"Arrivé",ARRIVED_DESTINATION:"Arrivé à destination",CLEARED:"Dédouané",READY_FOR_PICKUP:"Prêt au retrait",DELIVERED:"Livré",BLOCKED:"En attente de traitement",ISSUE:"Action requise"};

export default function PublicTrackingSearchPage(){
  const [reference,setReference]=useState("");
  const [tracking,setTracking]=useState<Awaited<ReturnType<typeof findPublicPackageTracking>>|null>(null);
  const [agency,setAgency]=useState<PublicAgencyProfile|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const request=useRef(0);
  const agencyKey=useRef<string|undefined>(undefined);
  const explain=useCallback((cause:unknown,profile=false)=>{
    const status=(cause as {status?:number})?.status;
    if(status===409)return 'Cette référence est utilisée par plusieurs agences. Ouvrez le lien de suivi communiqué par votre agence pour consulter le bon colis.';
    if(profile)return status===404?'Cette page de suivi est désactivée ou son lien a changé. Demandez le lien actuel à votre agence.':'La page de votre agence est momentanément inaccessible. Réessayez dans quelques instants.';
    if(status!==404)return 'Le suivi est momentanément indisponible. Réessayez dans quelques instants.';
    return 'Aucun colis public ne correspond à ce numéro. Vérifiez la référence et utilisez le lien de suivi de votre agence.';
  },[]);
  const lookup=useCallback(async(reference:string)=>{if(reference.trim().length<6)return;const current=++request.current;setLoading(true);setError("");setTracking(null);try{const result=await findPublicPackageTracking(reference,agencyKey.current||new URLSearchParams(window.location.search).get('agency') || undefined);if(request.current===current)setTracking(result);}catch(cause){if(request.current===current)setError(explain(cause));}finally{if(request.current===current)setLoading(false)}},[explain]);
  async function submit(event:FormEvent){event.preventDefault();await lookup(reference);}
  useEffect(()=>{let active=true;const pending=request;const params=new URLSearchParams(window.location.search),slug=params.get('agency'),initial=params.get('reference');if(initial)setReference(initial);
    async function open(){if(slug){setLoading(true);try{const profile=await findPublicAgency(slug);if(!active)return;setAgency(profile);agencyKey.current=profile.agency_key||slug;}catch(cause){if(active){setError(explain(cause,true));setLoading(false);}return;}}if(active){if(initial)await lookup(initial);else setLoading(false);}}
    void open();return()=>{active=false;pending.current++;};
  },[lookup,explain]);
  const brand=tracking || agency;
  const agencyName=brand?.agency_name || "Suivi colis";
  const agencyLogo=brand?.agency_logo_url;
  const brandColor=/^#[0-9a-f]{6}$/i.test(brand?.primary_color || '') ? brand?.primary_color || '#079456' : '#079456';
  useEffect(()=>{if(!brand?.favicon_url || !/^https:\/\//i.test(brand.favicon_url))return;const link=document.createElement('link');link.rel='icon';link.href=brand.favicon_url;document.head.appendChild(link);return()=>link.remove();},[brand?.favicon_url]);
  return <main className="min-h-screen bg-white px-5 py-12 text-[#20272e] sm:py-20">
    <div className="mx-auto max-w-2xl">
      <header className="text-center">
        {agencyLogo && /^https:\/\//i.test(agencyLogo) ? <div role="img" aria-label={`Logo ${agencyName}`} className="mx-auto h-16 w-32 bg-contain bg-center bg-no-repeat" style={{backgroundImage:`url(${JSON.stringify(agencyLogo)})`}}/> : <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#eaf8f1]" style={{color:brandColor}}><PackageSearch size={24}/></div>}
        {brand?.tracking_page?.show_brand && agencyName !== "Suivi colis" && <p className="mt-5 text-[13px] font-semibold uppercase tracking-[.12em]" style={{color:brandColor}}>{agencyName}</p>}
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Suivre un colis</h1>
        <p className="mx-auto mt-3 max-w-lg text-[14px] leading-6 text-[#69747d]">{brand?.tracking_page?.welcome_message || "Saisissez le numéro communiqué par votre agence pour consulter l’état et l’historique de votre colis."}</p>
        {brand?.agency_hours && <p className="mt-3 text-sm text-slate-500">Horaires : {brand.agency_hours}</p>}
      </header>
      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"><label className="flex h-12 min-w-0 flex-1 items-center rounded-lg border border-[#d8dee2] bg-white px-4 focus-within:border-[#12a865] focus-within:ring-2 focus-within:ring-[#12c76f]/10"><Search size={18} className="text-[#7a858e]"/><input value={reference} onChange={event=>setReference(event.target.value)} className="ml-3 min-w-0 flex-1 bg-transparent text-[14px] outline-none" placeholder="Ex. COL-2026-000123" aria-label="Numéro de suivi" autoComplete="off"/></label><button disabled={loading||reference.trim().length<6} className="h-12 shrink-0 rounded-lg bg-[#12c76f] px-5 text-[14px] font-semibold text-white disabled:opacity-50">{loading?"Recherche…":"Suivre"}</button></form>
      {error&&<p role="alert" className="mx-auto mt-5 max-w-xl rounded-lg bg-[#fff4f2] px-4 py-3 text-[13px] text-[#9b3d32]">{error}</p>}
      {tracking&&<section className="mt-8 overflow-hidden rounded-xl border border-[#dfe4e7] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5"><div><p className="text-[12px] text-[#77828b]">Numéro de suivi</p><h2 className="mt-1 text-xl font-semibold">{tracking.tracking_id||tracking.package_reference}</h2><p className="mt-2 text-[13px] text-[#68747d]">{[tracking.origin_city,tracking.origin_country].filter(Boolean).join(", ")||"Origine"} → {[tracking.destination_city,tracking.destination_country].filter(Boolean).join(", ")||"Destination"}</p></div><span className="rounded-full bg-[#eaf8f1] px-3 py-1.5 text-[12px] font-semibold text-[#087a48]">{statusLabels[tracking.status]||tracking.status}</span></div>
        <div className="grid border-y border-[#edf0f2] sm:grid-cols-3">{[["Dernière position",tracking.last_scan_location||"Non renseignée"],["Arrivée estimée",date(tracking.eta_at)],["Dernière mise à jour",date(tracking.updated_at)]].map(([label,value])=><div key={label} className="px-5 py-4 sm:border-r sm:border-[#edf0f2] sm:last:border-0"><p className="text-[11px] text-[#78838c]">{label}</p><p className="mt-1 text-[13px] font-medium">{value}</p></div>)}</div>
        <dl className="grid grid-cols-2 gap-4 border-b border-[#edf0f2] px-5 py-4">{[["Poids",measurement(tracking.weight_kg,"kg")],["Volume",measurement(tracking.volume_cbm,"m³")]].map(([label,value])=><div key={label}><dt className="text-[11px] text-[#78838c]">{label}</dt><dd className="mt-1 text-[13px] font-medium">{value}</dd></div>)}</dl>
        {tracking.customer_photos?.length>0&&<div className="border-b border-[#edf0f2] p-5"><h3 className="text-[14px] font-semibold">Photos partagées par l’agence</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{tracking.customer_photos.map(photo=><a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[#edf0f2]"><div role="img" aria-label={`Photo du colis ${photo.file_name}`} style={{backgroundImage:`url(${JSON.stringify(photo.url)})`}} className="aspect-square w-full bg-cover bg-center"/><span className="block truncate px-2 py-1.5 text-[11px] text-[#69747d]">{photo.file_name}</span></a>)}</div><p className="mt-2 text-[11px] text-[#89929a]">Les liens photos expirent après quelques minutes. Actualisez le suivi pour les renouveler.</p></div>}
        {tracking.tracking_page?.show_history !== false && <div className="p-5"><h3 className="text-[14px] font-semibold">Historique</h3><div className="mt-4 space-y-4">{tracking.events.length?tracking.events.map((item,index)=><article key={`${item.occurred_at}-${index}`} className="border-l-2 border-[#b7dec9] pl-4"><p className="text-[13px] font-medium">{item.new_status ? (statusLabels[item.new_status] || item.title) : item.title}</p>{item.description&&<p className="mt-1 text-[12px] text-[#69747d]">{item.description}</p>}<time className="mt-1 block text-[11px] text-[#89929a]">{date(item.occurred_at)}</time></article>):<p className="text-[13px] text-[#69747d]">Le premier événement de suivi apparaîtra bientôt.</p>}</div></div>}
        {tracking.fees_total != null && <p className="border-t border-[#edf0f2] px-5 py-3 text-sm">Tarif du transport : {new Intl.NumberFormat('fr-FR',{style:'currency',currency:tracking.currency || 'USD'}).format(Number(tracking.fees_total))}</p>}
        {tracking.tracking_page?.show_support && tracking.agency_support_phone && <p className="border-t border-[#edf0f2] px-5 py-3 text-[12px] text-[#69747d]">Support : {tracking.agency_support_phone}</p>}
      </section>}
    </div>
  </main>;
}

function date(value:string|null){return value?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—"}

function measurement(value:number|string|null|undefined,unit:string){
  if(value==null||String(value).trim()===""||!Number.isFinite(Number(value))||Number(value)<0)return "Non renseigné";
  return `${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:3}).format(Number(value))} ${unit}`;
}
