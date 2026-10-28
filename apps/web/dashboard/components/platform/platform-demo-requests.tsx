'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Mail, Phone, RefreshCcw, Search } from 'lucide-react';
import { OperationButton } from '@/components/ui/operation-controls';
import { OperationDrawer } from '@/components/ui/operation-drawer';
import { TableSkeleton } from '@/components/ui/page-state';
import { demoStatusLabels, platformDemoRequest, platformDemoRequests, updatePlatformDemoRequest, type DemoDetail, type DemoPage, type DemoStatus } from '@/services/platform-admin';

const field='min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
export const demoLabel=(value:string)=>demoStatusLabels[value as DemoStatus]||'Suivi à vérifier';
const date=(value:string)=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

export function PlatformDemoRequests({canManage,onSaved,refreshToken=0}:{canManage:boolean;onSaved:()=>void;refreshToken?:number}) {
  const [q,setQ]=useState(''),[status,setStatus]=useState<DemoStatus|''>(''),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
  const [data,setData]=useState<DemoPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState<DemoDetail|null>(null),[opening,setOpening]=useState(false);
  const openRequest=useRef(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    const timer=setTimeout(()=>{
      platformDemoRequests({q:q.trim()||undefined,status:status||undefined,page},controller.signal)
        .then(value=>{if(!controller.signal.aborted)setData(value);})
        .catch(()=>{if(!controller.signal.aborted)setError('Impossible de charger les demandes de démo. Réessayez.');})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },220);
    return()=>{clearTimeout(timer);controller.abort();};
  },[q,status,page,revision,refreshToken]);
  useEffect(()=>()=>{openRequest.current++;},[]);
  async function open(id:string){
    const request=++openRequest.current;setOpening(true);setError('');
    try{const detail=await platformDemoRequest(id);if(request===openRequest.current)setSelected(detail);}
    catch{if(request===openRequest.current)setError('La fiche de cette demande est indisponible. Réessayez.');}
    finally{if(request===openRequest.current)setOpening(false);}
  }
  return <section aria-label="Demandes de démo" className="min-w-0">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Demandes de démo</h2><p className="mt-1 text-sm text-slate-500">Demandes reçues depuis le site SLAIVIO et suivi de votre équipe.</p></div><OperationButton aria-label="Actualiser les demandes" onClick={()=>setRevision(value=>value+1)}><RefreshCcw size={15}/></OperationButton></div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><Search size={16} aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/><input type="search" maxLength={120} value={q} onChange={event=>{setQ(event.target.value);setPage(1);}} aria-label="Rechercher une demande de démo" placeholder="Nom, agence, e-mail, pays…" className={`${field} pl-9`}/></label><label className="grid gap-1 text-xs text-slate-500 sm:w-52"><span className="sr-only">Statut des demandes</span><select className={field} value={status} onChange={event=>{setStatus(event.target.value as DemoStatus|'');setPage(1);}}><option value="">Tous les statuts</option>{Object.entries(demoStatusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
    {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="min-h-64 rounded-xl border border-slate-200 bg-white">
      {loading?<div className="p-4"><TableSkeleton rows={5} columns={4}/></div>:error&&!data?null:!data?.items.length?<div className="p-10 text-center text-sm text-slate-500">{q||status?'Aucune demande ne correspond aux filtres.':'Aucune demande de démo reçue pour le moment.'}</div>:<>
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_150px_160px] gap-4 border-b border-slate-200 px-5 py-3 text-xs text-slate-500 lg:grid"><span>Contact et agence</span><span>Coordonnées</span><span>Suivi</span><span>Reçue le</span></div>
        <ul className="divide-y divide-slate-100">{data.items.map(item=><li key={item.id}><button type="button" disabled={opening} aria-label={`Ouvrir la demande de ${item.full_name}`} onClick={()=>void open(item.id)} className="grid w-full min-w-0 gap-3 px-5 py-4 text-left hover:bg-emerald-50/40 focus-visible:outline-emerald-600 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_150px_160px] lg:items-center">
          <span className="min-w-0"><strong className="block truncate text-sm font-medium text-slate-900">{item.full_name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{item.agency_name||'Agence non renseignée'} · {item.country||'Pays non renseigné'}</span></span><span className="min-w-0 text-xs text-slate-600"><span className="block break-all">{item.email}</span><span className="mt-1 block">{item.phone||'Téléphone non renseigné'}</span></span><span><span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${item.status==='NEW'?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{demoLabel(item.status)}</span></span><time dateTime={item.created_at} className="text-xs text-slate-500">{date(item.created_at)}</time>
        </button></li>)}</ul>
      </>}
    </div>
    {opening&&<p role="status" className="mt-3 text-sm text-slate-500">Ouverture de la demande…</p>}
    {data&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{data.total} demande(s) · Page {data.page} sur {data.total_pages}</span><div className="flex gap-2"><OperationButton aria-label="Page précédente" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={15}/></OperationButton><OperationButton aria-label="Page suivante" disabled={loading||page>=data.total_pages} onClick={()=>setPage(value=>value+1)}><ChevronRight size={15}/></OperationButton></div></div>}
    {selected&&<DemoSheet key={selected.request.id} initial={selected} canManage={canManage} close={()=>setSelected(null)} saved={()=>{setRevision(value=>value+1);onSaved();}}/>}
  </section>;
}

function DemoSheet({initial,canManage,close,saved}:{initial:DemoDetail;canManage:boolean;close:()=>void;saved:()=>void}) {
  const [detail,setDetail]=useState(initial),[status,setStatus]=useState(initial.request.status),[note,setNote]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const pending=useRef(false);
  const item=detail.request;
  async function reload(){try{setDetail(await platformDemoRequest(item.id));setError('');}catch{setError('Impossible de recharger la demande. Votre note est conservée.');}}
  async function submit(event:FormEvent){
    event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');
    try{
      const updated=await updatePlatformDemoRequest(item.id,{status,expected_updated_at:item.updated_at,note:note.trim()||null});
      setDetail(value=>({...value,request:updated}));setNote('');setNotice('Suivi enregistré.');saved();
      try{setDetail(await platformDemoRequest(item.id));}catch{setError('Le suivi est enregistré, mais son historique n’a pas pu être rechargé.');}
    }catch(cause){setError(axios.isAxiosError(cause)&&cause.response?.status===409?'Cette demande a été modifiée par un autre membre de l’équipe. Rechargez-la avant de réessayer ; votre note est conservée.':'Le suivi n’a pas pu être enregistré. Votre saisie est conservée.');}
    finally{pending.current=false;setBusy(false);}
  }
  return <OperationDrawer open title={`Demande de ${item.full_name}`} description={`Reçue le ${date(item.created_at)}`} close={()=>{if(!pending.current)close();}} width="max-w-[720px]">
    <dl className="grid gap-5 text-sm sm:grid-cols-2">{[['Contact',item.full_name],['Agence',item.agency_name],['Pays',item.country],['Volume mensuel annoncé',item.monthly_shipments]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value||'Non renseigné'}</dd></div>)}</dl>
    <div className="my-5 flex flex-wrap gap-3 text-sm"><a className="inline-flex items-center gap-2 break-all text-emerald-800 underline" href={`mailto:${encodeURIComponent(item.email)}`}><Mail size={15}/>{item.email}</a>{item.phone&&<a className="inline-flex items-center gap-2 text-emerald-800 underline" href={`tel:${item.phone.replace(/[^\d+]/g,'')}`}><Phone size={15}/>{item.phone}</a>}</div>
    <section className="rounded-lg bg-slate-50 p-4"><h3 className="text-xs font-medium text-slate-500">Besoin exprimé</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.message||'Aucun message complémentaire.'}</p></section>
    {canManage?<form onSubmit={submit} className="mt-6 grid gap-4"><h3 className="font-semibold text-slate-800">Suivi commercial</h3><label className="grid gap-2 text-xs text-slate-600">Statut<select value={status} disabled={busy} onChange={event=>setStatus(event.target.value as DemoStatus)} className={field}>{Object.entries(demoStatusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="grid gap-2 text-xs text-slate-600">Note interne<textarea value={note} disabled={busy} onChange={event=>setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Échange avec le contact, prochaine étape, date convenue…" className={`${field} py-2`}/></label><p className="text-xs text-slate-500">Réservé à l’équipe SLAIVIO. Modifier le suivi n’envoie aucun message au contact.</p><div className="flex flex-wrap gap-2"><OperationButton type="submit" variant="primary" disabled={busy}>{busy?'Enregistrement…':'Enregistrer le suivi'}</OperationButton><OperationButton disabled={busy} onClick={()=>void reload()}>Recharger la demande</OperationButton></div></form>:<p className="mt-5 text-sm text-slate-500">Consultation seule : la gestion des agences est nécessaire pour modifier ce suivi.</p>}
    {notice&&<p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}{error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <section className="mt-7 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-800">Historique du suivi</h3>{detail.history.length?<ol className="mt-4 space-y-4">{detail.history.map(event=><li key={event.id} className="border-l-2 border-emerald-100 pl-3"><p className="text-sm text-slate-700">{demoLabel(event.old_data?.status||'')} → {demoLabel(event.new_data?.status||'')}</p><time dateTime={event.created_at} className="text-xs text-slate-500">{date(event.created_at)} · Équipe SLAIVIO</time>{event.reason&&<p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{event.reason}</p>}</li>)}</ol>:<p className="mt-3 text-sm text-slate-500">Aucun suivi enregistré pour le moment.</p>}</section>
  </OperationDrawer>;
}
