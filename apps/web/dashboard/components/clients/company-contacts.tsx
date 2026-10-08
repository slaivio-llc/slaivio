"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { InternationalPhone } from './international-phone';

type Contact = {id:string;name:string;role_label:string|null;phone:string|null;email:string|null;is_primary:boolean;row_version:number};
const input = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600';

export function CompanyContacts({clientId,editable}: {clientId:string;editable:boolean}) {
  const [items,setItems] = useState<Contact[]>([]);
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState(false);
  const [error,setError] = useState('');
  const [form,setForm] = useState<Contact|'new'|null>(null);
  const [busy,setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(()=>{
    const abort = new AbortController();setLoading(true);setLoadError(false);
    api.get<{items:Contact[]}>(`/clients/${clientId}/contacts`,{signal:abort.signal})
      .then(r=>{if(!abort.signal.aborted)setItems(r.data.items);})
      .catch(()=>{if(!abort.signal.aborted)setLoadError(true);})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[clientId,revision]);
  async function save(payload: Record<string,unknown>) {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');
    try {await api.post(`/clients/${clientId}/contacts`,payload);setForm(null);setRevision(v=>v+1);}
    catch {setError('Enregistrement impossible. Vérifiez les champs ; si le contact a changé, rechargez sa liste avant de réessayer.');}
    finally {inFlight.current=false;setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data = new FormData(event.currentTarget);
    const value = (key:string)=>String(data.get(key)||'').trim();
    void save({...(form && form!=='new'?{id:form.id,row_version:form.row_version}:{}),
      name:value('name'),role_label:value('role_label'),phone:value('phone'),
      phone_region:value('phone_region')||undefined,email:value('email'),is_primary:data.has('is_primary')});
  }
  return <section className="mt-8 space-y-4" aria-label="Contacts de l’entreprise">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Contacts de l’entreprise</h3>
      {editable && !form && <button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=>{setForm('new');setError('');}}>Ajouter un contact</button>}</div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading ? <p role="status">Chargement des contacts…</p> : loadError ? <p role="alert">Impossible de charger les contacts. <button type="button" className="underline" onClick={()=>setRevision(v=>v+1)}>Réessayer</button></p> :
      <ul className="divide-y divide-slate-100">{!items.length && <li className="text-sm text-slate-500">Aucun contact enregistré.</li>}{items.map(item=>
        <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{item.name}{item.is_primary?' · Principal':''}</p>
          <p className="text-slate-500">{[item.role_label,item.phone,item.email].filter(Boolean).join(' · ')}</p></div>
          {editable && <div className="flex gap-2"><button type="button" disabled={busy} className="rounded border px-2" onClick={()=>{setForm(item);setError('');}}>Modifier</button>
            <button type="button" disabled={busy} className="rounded border px-2" onClick={()=>{if(window.confirm(`Archiver le contact ${item.name} ?`))void save({id:item.id,row_version:item.row_version,archive:true});}}>Archiver</button></div>}
        </li>)}</ul>}
    {form && <form key={form==='new'?'new':`${form.id}:${form.row_version}`} onSubmit={submit} className="grid max-w-xl gap-4 rounded-lg border p-4">
      <label className="grid gap-1 text-sm">Nom du contact<input className={input} name="name" required maxLength={160} defaultValue={form==='new'?'':form.name}/></label>
      <label className="grid gap-1 text-sm">Fonction<input className={input} name="role_label" maxLength={120} defaultValue={form==='new'?'':form.role_label||''}/></label>
      <InternationalPhone className={input} defaultValue={form==='new'?'':form.phone||''}/>
      <label className="grid gap-1 text-sm">E-mail<input className={input} name="email" type="email" maxLength={180} defaultValue={form==='new'?'':form.email||''}/></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="is_primary" defaultChecked={form==='new'?false:form.is_primary}/>Contact principal</label>
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setForm(null)} className="rounded border px-3 py-2 text-sm">Annuler</button>
        <button disabled={busy} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white">{busy?'Enregistrement…':'Enregistrer'}</button></div>
    </form>}
  </section>;
}
