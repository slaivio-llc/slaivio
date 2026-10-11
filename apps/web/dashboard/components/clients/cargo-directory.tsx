"use client";
import { useEffect,useState } from 'react';
import { Download, Search } from 'lucide-react';
import { OperationButton, OperationFilterPopover } from '@/components/ui/operation-controls';
import { TableSkeleton } from '@/components/ui/page-state';
import { api } from '@/services/api';
type Entry={id:string;client_reference:string;display_name:string;phone:string|null;customer_type:string;last_activity_at:string|null};
type Result={items:Entry[];total:number;page:number;total_pages:number};
const field='h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm';
export function CargoDirectory({open,revision,canExport=false}:{open:(id:string)=>void;revision:number;canExport?:boolean}) {
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState(false);
  async function exportDirectory() {
    if(exporting||invalidDates)return;
    setExporting(true);setExportError(false);
    try {
      const response=await api.get<Blob>('/clients/directory/export',{params:{q,customer_type:type||undefined,sort,start:dates.start||undefined,end:dates.end||undefined},responseType:'blob'});
      const url=URL.createObjectURL(response.data);
      const link=document.createElement('a');link.href=url;link.download='clients.csv';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {setExportError(true);} finally {setExporting(false);}
  }
  const [q,setQ]=useState('');const [type,setType]=useState('');const [page,setPage]=useState(1);
  const [sort,setSort]=useState('name_asc');const [dates,setDates]=useState({start:'',end:''});
  const [result,setResult]=useState<Result|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  const invalidDates=Boolean(dates.start&&dates.end&&dates.start>dates.end);
  useEffect(()=>{
    if(invalidDates)return;
    const controller=new AbortController();
    setLoading(true);setError(false);
    const timer=window.setTimeout(()=>{
      setLoading(true);setError(false);
      api.get<Result>('/clients/directory',{params:{q,customer_type:type||undefined,page,sort,start:dates.start||undefined,end:dates.end||undefined},signal:controller.signal})
        .then(r=>{if(!controller.signal.aborted)setResult(r.data);})
        .catch(()=>{if(!controller.signal.aborted)setError(true);})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },250);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[q,type,page,sort,dates,retry,revision,invalidDates]);
  const filtered=Boolean(q||type||dates.start||dates.end);
  return <section className="mx-auto w-full max-w-[1200px] px-6 pb-8 sm:px-8" aria-label="Répertoire clients">
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <label className="relative mr-auto block w-full sm:max-w-xs"><Search size={15} aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/><input type="search" maxLength={120} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} aria-label="Rechercher par nom, téléphone ou référence" placeholder="Rechercher un client…" className={`${field} w-full pl-9`}/></label>
        <select aria-label="Trier les clients" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}} className={field}><option value="name_asc">Nom A–Z</option><option value="name_desc">Nom Z–A</option><option value="activity_desc">Activité récente</option><option value="created_desc">Création récente</option></select>
        <OperationFilterPopover activeCount={Number(Boolean(type))+Number(Boolean(dates.start||dates.end))} onReset={()=>{setType('');setDates({start:'',end:''});setPage(1);}} title="Filtrer les clients">
          <label className="grid gap-1.5 text-xs font-medium">Type<select value={type} onChange={e=>{setType(e.target.value);setPage(1);}} className={field}><option value="">Tous les clients</option><option value="individual">Particuliers</option><option value="business">Entreprises</option></select></label>
          <label className="grid gap-1.5 text-xs font-medium">Créé à partir du (UTC)<input type="date" value={dates.start} onChange={e=>{setDates(value=>({...value,start:e.target.value}));setPage(1);}} className={field}/></label>
          <label className="grid gap-1.5 text-xs font-medium">Jusqu’au (UTC)<input type="date" value={dates.end} min={dates.start||undefined} onChange={e=>{setDates(value=>({...value,end:e.target.value}));setPage(1);}} className={field}/></label>
        </OperationFilterPopover>
        {canExport && <OperationButton type="button" disabled={exporting||invalidDates} onClick={exportDirectory} aria-label="Exporter les résultats filtrés" title="Exporter les résultats filtrés (10 000 maximum)" className="w-9 px-0"><Download size={15} aria-hidden="true"/></OperationButton>}
      </div>
      {exportError && <p role="alert" className="px-4 pb-3 text-sm text-red-700">Export impossible. Vérifiez vos droits et limitez les résultats à 10 000 clients.</p>}
{invalidDates?<p role="alert" className="p-5 text-sm text-red-700">La date de fin doit suivre la date de début.</p>:error?<div role="alert" className="p-6 text-sm">Impossible de charger les clients. <button type="button" onClick={()=>setRetry(v=>v+1)} className="underline">Réessayer</button></div>:loading?<TableSkeleton rows={6} columns={3} label="Chargement des clients"/>:!result?.items.length?<div className="px-6 py-16 text-center"><h2 className="text-sm font-semibold">{filtered?'Aucun résultat correspondant':'Aucun client pour le moment'}</h2><p className="mt-2 text-sm text-slate-500">{filtered?'Essayez une autre recherche ou effacez les filtres.':'Utilisez Nouveau client pour enregistrer votre premier client.'}</p>{filtered&&<OperationButton type="button" className="mt-3" onClick={()=>{setQ('');setType('');setDates({start:'',end:''});setPage(1);}}>Effacer les filtres</OperationButton>}</div>:<>
        <div className="hidden grid-cols-[2fr_1.3fr_1fr] gap-4 bg-slate-50/80 px-5 py-3 text-xs font-medium text-slate-500 sm:grid"><span>Client</span><span>Téléphone</span><span>Dernière activité</span></div>
        <ul className="divide-y divide-slate-100">{result.items.map(item=><li key={item.id}><button type="button" onClick={()=>open(item.id)} className="grid w-full gap-2 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-emerald-700 sm:grid-cols-[2fr_1.3fr_1fr] sm:items-center sm:gap-4">
          <span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">{(item.display_name||'?').slice(0,2).toLocaleUpperCase('fr')}</span><span className="min-w-0"><strong className="block truncate text-sm font-medium">{item.display_name||'Sans nom'}</strong><span className="text-xs text-slate-500">{item.client_reference}{item.customer_type==='business'?' · Entreprise':''}</span></span></span>
          <span className="text-sm text-slate-600">{item.phone||'Téléphone non renseigné'}</span><span className="text-xs text-slate-500">{item.last_activity_at?new Intl.DateTimeFormat('fr',{dateStyle:'medium'}).format(new Date(item.last_activity_at)):'Aucune activité enregistrée'}</span>
        </button></li>)}</ul>
        <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-4 text-xs text-slate-500"><span className="mr-auto">{(page-1)*50+1}–{Math.min(page*50,result.total)} sur {result.total}</span><OperationButton type="button" disabled={page===1} onClick={()=>setPage(v=>v-1)}>Précédent</OperationButton><OperationButton type="button" disabled={page>=result.total_pages} onClick={()=>setPage(v=>v+1)}>Suivant</OperationButton></div>
      </>}
    </div>
  </section>;
}
