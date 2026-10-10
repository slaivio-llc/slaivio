"use client";
import { useEffect,useRef,useState } from 'react';
import { api } from '@/services/api';
import { switchTenant } from '@/services/tenant';
type Entry={id:string;org_id?:string;client_reference:string;display_name:string;phone:string|null;customer_type:string;office_name:string;last_activity_at:string|null};
type Result={items:Entry[];total:number;page:number;total_pages:number;active_org_id?:string};
const field='h-9 rounded-md border border-slate-300 bg-white px-3 text-sm';
export function CargoDirectory({open,revision,canExport=false,canViewNetwork=false}:{open:(id:string)=>void;revision:number;canExport?:boolean;canViewNetwork?:boolean}) {
  const [offices,setOffices]=useState<{org_id:string;name:string}[]>([]);
  const [office,setOffice]=useState('');
  const [officeError,setOfficeError]=useState(false);
  const [switching,setSwitching]=useState(false);
  const switchingRef=useRef(false);
  useEffect(()=>{
    if(!canViewNetwork)return;
    const abort=new AbortController();
    api.get<{items:{org_id:string;name:string}[]}>('/clients/directory/offices',{signal:abort.signal})
      .then(response=>{if(!abort.signal.aborted){setOffices(response.data.items);setOfficeError(false);}})
      .catch(()=>{if(!abort.signal.aborted)setOfficeError(true);});
    return ()=>abort.abort();
  },[canViewNetwork,revision]);
  async function openEntry(item:Entry) {
    if(switchingRef.current)return;
    if(!item.org_id||!result?.active_org_id||item.org_id===result.active_org_id){open(item.id);return;}
    switchingRef.current=true;setSwitching(true);setOfficeError(false);
    try {
      await switchTenant(item.org_id);
      window.sessionStorage.removeItem('slaivio:dashboard-home');
      window.location.assign(`/app/clients?open=${encodeURIComponent(item.id)}`);
    } catch {switchingRef.current=false;setOfficeError(true);setSwitching(false);}
  }
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState(false);
  async function exportDirectory() {
    if(exporting)return;
    setExporting(true);setExportError(false);
    try {
      const response=await api.get<Blob>('/clients/directory/export',{params:{q,customer_type:type||undefined,office_id:office||undefined,sort,start:dates.start||undefined,end:dates.end||undefined},responseType:'blob'});
      const url=URL.createObjectURL(response.data);
      const link=document.createElement('a');link.href=url;link.download='clients.csv';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {setExportError(true);} finally {setExporting(false);}
  }
  const [q,setQ]=useState('');const [type,setType]=useState('');const [page,setPage]=useState(1);
  const [sort,setSort]=useState('name_asc');const [dates,setDates]=useState({start:'',end:''});
  const [result,setResult]=useState<Result|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      setLoading(true);setError(false);
      api.get<Result>('/clients/directory',{params:{q,customer_type:type||undefined,office_id:office||undefined,page,sort,start:dates.start||undefined,end:dates.end||undefined},signal:controller.signal})
        .then(r=>{if(!controller.signal.aborted)setResult(r.data);})
        .catch(()=>{if(!controller.signal.aborted)setError(true);})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },250);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[q,type,page,sort,dates,retry,revision,office]);
  const filtered=Boolean(q||type||dates.start||dates.end);
  return <section className="mx-auto grid max-w-[1200px] gap-4 px-6 py-6 sm:px-8" aria-label="Répertoire clients">
    <label className="grid gap-1 text-sm">Rechercher par nom, téléphone ou référence<input type="search" maxLength={120} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} className={field}/></label>
    {offices.length>1 && <label className="flex flex-wrap items-center gap-2 text-sm">Bureau<select className={field} value={office} onChange={e=>{setOffice(e.target.value);setPage(1);}}><option value="">Bureau actif</option><option value="all">Tous mes bureaux autorisés</option>{offices.map(item=><option key={item.org_id} value={item.org_id}>{item.name}</option>)}</select></label>}
    {officeError && <p role="alert" className="text-sm text-red-700">Accès aux bureaux indisponible. Rechargez la page pour réessayer.</p>}
    {switching && <p role="status" className="text-sm">Ouverture du bureau du client…</p>}
    <div className="flex flex-wrap items-center gap-2">{[['','Tous les clients'],['business','Entreprises']].map(([value,label])=><button key={value} type="button" aria-pressed={type===value} onClick={()=>{setType(value);setPage(1);}} className={`${field} ${type===value?'border-emerald-600 bg-emerald-50 text-emerald-800':''}`}>{label}</button>)}
      <label className="ml-auto text-sm">Trier <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}} className={field}><option value="name_asc">Nom A–Z</option><option value="name_desc">Nom Z–A</option><option value="activity_desc">Activité récente</option><option value="created_desc">Création récente</option></select></label>
      <details className="relative"><summary className={`${field} cursor-pointer py-2`}>Filtres</summary><form key={`${type}:${dates.start}:${dates.end}`} className="absolute right-0 z-20 grid w-72 gap-3 rounded-lg border bg-white p-4 shadow-lg" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);setType(String(form.get('type')||''));setDates({start:String(form.get('start')||''),end:String(form.get('end')||'')});setPage(1);e.currentTarget.closest('details')?.removeAttribute('open');}}>
        <label className="grid gap-1 text-sm">Type<select name="type" defaultValue={type} className={field}><option value="">Tous</option><option value="individual">Particulier</option><option value="business">Entreprise</option></select></label>
        <label className="grid gap-1 text-sm">Créé à partir du (UTC)<input type="date" name="start" defaultValue={dates.start} className={field}/></label><label className="grid gap-1 text-sm">Jusqu’au (UTC)<input type="date" name="end" defaultValue={dates.end} className={field}/></label>
        <button type="submit" className={`${field} text-emerald-800`}>Appliquer</button><button type="button" onClick={()=>{setType('');setDates({start:'',end:''});setPage(1);}}>Réinitialiser</button>
      </form></details>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{office?'L’ouverture d’un client change le bureau actif si nécessaire.':'Bureau actif uniquement.'} Les dates de création sont filtrées en UTC.</p>
      {canExport && <details className="relative"><summary className={`${field} cursor-pointer py-2`}>Actions</summary>
        <div className="absolute right-0 z-20 w-60 rounded-lg border bg-white p-2 shadow-lg"><button type="button" disabled={exporting} className="w-full rounded p-2 text-left text-sm" onClick={exportDirectory}>{exporting?'Export en cours…':'Exporter les résultats filtrés'}</button><p className="px-2 text-xs text-slate-500">10 000 clients maximum.</p></div>
      </details>}
    </div>
    {exportError && <p role="alert" className="text-sm text-red-700">Export impossible. Réduisez les résultats à 10 000 clients maximum et réessayez.</p>}
    {error?<div role="alert">Impossible de charger les clients. <button onClick={()=>setRetry(v=>v+1)} className="underline">Réessayer</button></div>:loading?<div role="status" aria-label="Chargement des clients" className="grid gap-3 py-3">{[1,2,3,4,5].map(n=><div key={n} className="h-12 animate-pulse rounded bg-slate-100"/>)}</div>:!result?.items.length?<div className="py-10 text-center"><h2 className="font-semibold">{filtered?'Aucun résultat correspondant':'Aucun client pour le moment'}</h2><p className="mt-2 text-sm text-slate-500">{filtered?'Vérifiez la recherche ou réinitialisez les filtres.':'Utilisez Nouveau client pour enregistrer votre premier client.'}</p>{filtered&&<button className={`${field} mt-3`} onClick={()=>{setQ('');setType('');setDates({start:'',end:''});setPage(1);}}>Effacer les filtres</button>}</div>:<>
      <div className="hidden grid-cols-[2fr_1.3fr_1fr] gap-4 px-3 text-xs text-slate-500 sm:grid"><span>Client</span><span>Téléphone</span><span>Dernière activité</span></div>
<ul className="grid gap-1">{result.items.map(item=><li key={item.id}><button type="button" disabled={switching} onClick={()=>void openEntry(item)} className="grid w-full gap-2 rounded-md border border-slate-100 p-3 text-left hover:bg-slate-50 sm:grid-cols-[2fr_1.3fr_1fr] sm:gap-4"><span><strong className="block text-sm">{item.display_name||'Sans nom'}</strong><span className="text-xs text-slate-500">{item.client_reference}{office ? ` · ${item.office_name}` : ''}{item.customer_type==='business'?' · Entreprise':''}</span></span><span className="text-sm">{item.phone||'Téléphone non renseigné'}</span><span className="text-xs text-slate-500">{item.last_activity_at?new Intl.DateTimeFormat('fr',{dateStyle:'medium'}).format(new Date(item.last_activity_at)):'Aucune activité enregistrée'}</span></button></li>)}</ul>
      <div className="flex items-center justify-end gap-3 text-sm"><span>{(page-1)*50+1}–{Math.min(page*50,result.total)} sur {result.total}</span><button className={field} disabled={page===1} onClick={()=>setPage(v=>v-1)}>Précédent</button><button className={field} disabled={page>=result.total_pages} onClick={()=>setPage(v=>v+1)}>Suivant</button></div>
    </>}
  </section>;
}
