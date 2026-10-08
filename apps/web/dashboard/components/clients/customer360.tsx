"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { ClientRecord } from '@/services/clients';
import { usePermissions } from '@/components/permissions/permission-provider';
import { OperationDrawer, OperationDrawerAction, OperationDrawerTabs } from '@/components/ui/operation-drawer';
import { CompanyContacts } from './company-contacts';

const sections = [
  {key:'overview',label:'Aperçu',permission:'clients.read'},
  {key:'packages',label:'Colis',permission:'packages.read'},
  {key:'shipments',label:'Expéditions',permission:'shipments.read'},
  {key:'finance',label:'Finance',permission:'finance.read'},
  {key:'communications',label:'Communications',permission:'inbox.read'},
  {key:'activity',label:'Activité',permission:'clients.read'},
];
type Item = {id:string;reference?:string;status?:string;occurred_at?:string;text_body?:string;
  document_id?:string;document_type?:string;
  direction?:string;action?:string;currency?:string;total?:number;balance_due?:number;
  destination_city?:string;destination_country?:string;tracking_id?:string};
type Result = {client?:ClientRecord;items?:Item[];total?:number;page_size?:number;
  balances?:{currency:string;paid:number;outstanding:number}[]};
const actionNames:Record<string,string> = {'client.created':'Client créé','client.updated':'Fiche modifiée',
  'client.archived':'Client archivé','client.restored':'Client restauré','client.merged':'Doublon fusionné','client.merged_into':'Client fusionné'};
const date = (value?:string|null) => value ? new Date(value).toLocaleString('fr-FR') : 'Non renseignée';
const money = (value:number|string|undefined,currency:string) => new Intl.NumberFormat('fr-FR',{style:'currency',currency}).format(Number(value||0));

export function Customer360({client,close,edit,archive,busy}: {
  client:ClientRecord;close:()=>void;edit:()=>void;archive:()=>void;busy:boolean;
}) {
  const {permissions} = usePermissions();
  const tabs = sections.filter(section=>permissions.includes(section.permission));
  const [section,setSection] = useState('overview');
  const [page,setPage] = useState(1);
  const [retry,setRetry] = useState(0);
  const [result,setResult] = useState<Result|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true);setError(false);setResult(null);
    api.get<Result>(`/clients/${client.id}/crm/${section}`,{params:{page},signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted)setResult(response.data);})
      .catch(()=>{if(!controller.signal.aborted)setError(true);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[client.id,client.row_version,section,page,retry]);
  const identity = result?.client;
  const total = result?.total || 0;
  const pages = Math.max(1,Math.ceil(total/25));
  return <OperationDrawer open close={close} width="max-w-5xl" title={client.display_name||client.name||client.company_name||'Client'}
    description={`Fiche client · ${client.customer_type==='business'?'Entreprise':'Particulier'}`}
    headerActions={<>
      {permissions.includes('clients.update') && <OperationDrawerAction icon="edit" onClick={edit}>Modifier</OperationDrawerAction>}
      {permissions.includes('clients.archive') && <OperationDrawerAction icon="archive" intent="danger" onClick={archive} disabled={busy}>Archiver</OperationDrawerAction>}
    </>}
    tabs={<OperationDrawerTabs items={tabs} value={section} primaryCount={6} onChange={value=>{setSection(value);setPage(1);}}/>}>
    {loading ? <p role="status" className="p-5 text-sm text-slate-500">Chargement de la fiche…</p> : error ?
      <div role="alert" className="p-5 text-sm"><p>Impossible de charger cette section. Vos droits ont peut-être changé.</p><button type="button" className="mt-3 underline" onClick={()=>setRetry(v=>v+1)}>Réessayer</button></div> :
      section==='overview' && identity ? <><dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {Object.entries({'Référence':identity.client_reference,'Téléphone':identity.phone,'E-mail':identity.email,
          'Pays':identity.country,'Ville':identity.city,'Adresse':identity.address,
          'Création':date(identity.created_at),'Dernière activité':date(identity.last_activity_at)}).map(([label,value])=>
            <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm">{value||'Non renseigné'}</dd></div>)}
      </dl>{identity.customer_type==='business' && <CompanyContacts clientId={client.id} editable={permissions.includes('clients.update')}/>}</> : <div className="space-y-4">
        {section==='finance' && Boolean(result?.balances?.length) && <div className="grid gap-3 sm:grid-cols-2">{result?.balances?.map(balance=>
          <div key={balance.currency} className="rounded-lg border p-4 text-sm"><h3 className="font-semibold">{balance.currency}</h3>
            <p className="mt-2">Encaissé sur factures : {money(balance.paid,balance.currency)}</p><p>Solde facturé : {money(balance.outstanding,balance.currency)}</p></div>)}</div>}
        {!result?.items?.length ? <p className="py-8 text-center text-sm text-slate-500">Aucun élément dans cette section.</p> :
          <ul className="divide-y divide-slate-100">{result.items.map(item=>{
            const href = section==='packages'?`/app/packages?open=${encodeURIComponent(item.id)}`:
              section==='shipments'?`/app/shipments/${encodeURIComponent(item.id)}`:
              section==='finance'?`/app/finance?open=${encodeURIComponent(item.document_id||item.id)}`:null;
            return <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
              <div className="min-w-0 flex-1">
                {href ? <Link href={href} className="font-medium text-emerald-800 underline underline-offset-4">{item.reference}</Link> :
                  <p className="font-medium">{section==='activity'?actionNames[item.action||'']||'Fiche mise à jour':item.direction==='outbound'?'Message sortant':'Message entrant'}</p>}
                {item.text_body && <p className="mt-2 whitespace-pre-wrap break-words">{item.text_body}</p>}
                {item.tracking_id && <p className="mt-1 text-slate-500">Suivi : {item.tracking_id}</p>}
                {(item.destination_city||item.destination_country) && <p className="mt-1 text-slate-500">{[item.destination_city,item.destination_country].filter(Boolean).join(', ')}</p>}
                <p className="mt-1 text-xs text-slate-500">{date(item.occurred_at)}</p>
              </div>
              <div className="text-right"><p className="text-xs">{item.status?.replaceAll('_',' ')}</p>
                {item.currency && <><p className="mt-1">{money(item.total,item.currency)}</p>{item.document_type!=='RECEIPT' && <p className="text-xs text-slate-500">Solde : {money(item.balance_due,item.currency)}</p>}</>}
              </div>
            </li>;
          })}</ul>}
        {total>0 && <nav aria-label="Pagination de la fiche" className="flex items-center justify-between gap-2 text-sm">
          <button type="button" disabled={page===1} onClick={()=>setPage(p=>p-1)} className="rounded border px-3 py-2 disabled:opacity-40">Précédent</button>
          <span>{page} / {pages} · {total} éléments</span>
          <button type="button" disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="rounded border px-3 py-2 disabled:opacity-40">Suivant</button>
        </nav>}
      </div>}
  </OperationDrawer>;
}
