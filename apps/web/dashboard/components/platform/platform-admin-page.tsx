'use client';
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Building2, CreditCard, Headphones, History, LayoutDashboard, RefreshCcw, ShieldCheck, Users, Video } from 'lucide-react';
import { OperationButton } from '@/components/ui/operation-controls';
import { OperationPageHeader, OperationTabs } from '@/components/ui/operation-page-header';
import { OperationMetrics } from '@/components/ui/operation-primitives';
import { ErrorState, ForbiddenState, LoadingState } from '@/components/ui/page-state';
import { platformAccessDetails, platformOverview, type ConsoleRow, type PlatformMetrics } from '@/services/platform-admin';
import { PlatformDemoRequests } from './platform-demo-requests';
import { PlatformBusinessOverview } from './platform-business-overview';
import { PlatformRegister } from './platform-register';
import { PlatformAgencySheet } from './platform-agency-sheet';
import { PlatformSupportSheet } from './platform-support-sheet';
import { PlatformBilling } from './platform-billing';
import { PlatformOperators } from './platform-operators';
import { PlatformOperations } from './platform-operations';
import { Alert } from './platform-console-ui';

export function PlatformAdminPage(){
  useDashboardMessages();
 const [allowed,setAllowed]=useState<boolean|null>(null),[granted,setGranted]=useState<string[]>([]),[currentUser,setCurrentUser]=useState(''),[tab,setTab]=useState('overview');
 const [metrics,setMetrics]=useState<PlatformMetrics|null>(null),[error,setError]=useState(''),[checking,setChecking]=useState(true),[refreshing,setRefreshing]=useState(false),[revision,setRevision]=useState(0);
 const [agency,setAgency]=useState<string|null>(null),[ticket,setTicket]=useState<string|null>(null);
 const generation=useRef(0),pending=useRef(false);
 const load=useCallback(async()=>{
  if(pending.current)return;pending.current=true;setRefreshing(true);setError('');
  const request=++generation.current;
  try{
   const access=await platformAccessDetails();if(request!==generation.current)return;
   setAllowed(access.allowed);setGranted(access.permissions||[]);setCurrentUser(access.user_id||'');
   if(!access.allowed)return;
   const value=await platformOverview();if(request!==generation.current)return;setMetrics(value);setRevision(value=>value+1);
  }catch(cause){if(request!==generation.current)return;if(axios.isAxiosError(cause)&&cause.response?.status===403)setAllowed(false);else setError('La console ne répond pas. Réessayez. Les données précédemment chargées ne sont pas actualisées.');}
  finally{if(request===generation.current){pending.current=false;setChecking(false);setRefreshing(false);}}
 },[]);
 useEffect(()=>{void load();const request=generation.current;return()=>{generation.current=request+1;pending.current=false;};},[load]);
 const refreshMetrics=()=>{setRevision(value=>value+1);platformOverview().then(setMetrics).catch(()=>setError('L’action est enregistrée, mais les indicateurs n’ont pas pu être actualisés.'));};
 const can=(permission:string)=>granted.includes(permission);
 if(checking)return <LoadingState label={dashboardText("Ouverture de la console Super Admin…")}/>;
 if(allowed===false)return <ForbiddenState description={dashboardText("Cette console est réservée aux opérateurs internes SLAIVIO explicitement autorisés.")}/>;
 if(!metrics)return <ErrorState title={dashboardText("Console temporairement indisponible")} description={error||dashboardText("Les indicateurs ne sont pas disponibles.")} retry={()=>void load()}/>;
 const tabs=[
  {id:'overview',title:'Vue d’ensemble',icon:LayoutDashboard},
  {id:'demos',title:'Demandes de démo',icon:Video},
  {id:'agencies',title:'Agences',icon:Building2},
  ...(can('platform.billing.manage')?[{id:'billing',title:'Abonnements et paiements',icon:CreditCard}]:[]),
  ...(can('platform.support.manage')?[{id:'tickets',title:'Support',icon:Headphones}]:[]),
  ...(can('quarantine.read')?[{id:'operations',title:'Suivi technique',icon:Activity}]:[]),
  ...(can('platform.audit.read')?[{id:'audit',title:'Journal des actions',icon:History}]:[]),
  ...(can('platform.permissions.manage')?[{id:'operators',title:'Équipe SLAIVIO',icon:Users}]:[]),
 ];
 const active=tabs.some(item=>item.id===tab)?tab:'overview';
 const openAgency=(row:ConsoleRow)=>setAgency(String(row.org_id||row.id));
 const cards:Array<[string,number,string]>=[['Agences actives',metrics.active_agencies,'agencies'],['Agences inscrites',metrics.agencies,'agencies'],['Essais en cours',metrics.trials,'billing'],['Abonnements payants en cours',metrics.paid_subscriptions,'billing'],['Demandes de démo',metrics.demo_requests,'demos'],['Nouvelles demandes',metrics.new_demo_requests,'demos'],['Tickets ouverts',metrics.open_tickets,'tickets'],['Événements à vérifier',metrics.quarantined_events,'operations']];
 return <div className="min-h-full min-w-0 bg-white">
  <OperationPageHeader title={dashboardText("Super Admin")} description={dashboardText("Pilotage interne de SLAIVIO : acquisition, agences, abonnements et qualité de service.")} actions={<OperationButton disabled={refreshing} onClick={()=>void load()} aria-label={dashboardText("Actualiser la console")}><RefreshCcw size={15}/>{refreshing?dashboardText("Actualisation…"):dashboardText("Actualiser la console")}</OperationButton>}/>
  <div className="flex items-center gap-2 border-b border-[#e5e9ed] bg-[#f5fbf7] px-6 py-2 text-xs text-[#087a46] sm:px-8"><ShieldCheck size={14}/><span>{dashboardText("Espace interne SLAIVIO · Accès protégé et actions historisées")}</span></div>
  <OperationMetrics><div className="grid grid-cols-2 gap-4 py-4 lg:grid-cols-4">{cards.map(([title,value,target])=><div key={title} className="min-w-0">{tabs.some(item=>item.id===target)?<button className="group w-full text-left" onClick={()=>setTab(target)}><span className="text-xs text-[#69747f] group-hover:text-[#087a46]">{title}</span><strong className="mt-2 block text-2xl font-semibold text-[#242a30] group-hover:text-[#087a46]">{value}</strong></button>:<><span className="text-xs text-[#69747f]">{title}</span><strong className="mt-2 block text-2xl font-semibold text-[#242a30]">{value}</strong></>}</div>)}</div></OperationMetrics>
  <OperationTabs><nav aria-label={dashboardText("Sections Super Admin")} className="flex min-w-0 gap-1 overflow-x-auto">{tabs.map(({id,title,icon:Icon})=><button key={id} type="button" aria-current={active===id?'page':undefined} onClick={()=>setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm ${active===id?'border-[#087a46] font-semibold text-[#087a46]':'border-transparent text-[#69747f] hover:bg-[#f7faf8] hover:text-[#087a46]'}`}><Icon size={15}/>{title}{id==='demos'&&metrics.new_demo_requests>0&&<span className="rounded-full bg-[#e8f8ef] px-2 py-0.5 text-xs text-[#087a46]">{metrics.new_demo_requests}</span>}</button>)}</nav></OperationTabs>
  <main className="mx-auto grid w-full min-w-0 max-w-[1400px] gap-5 px-4 py-6 sm:px-8">
   {error&&<Alert>{dashboardText(error)}</Alert>}
   {active==='overview'&&<PlatformBusinessOverview metrics={metrics} openDemos={()=>setTab('demos')}/>}
   {active==='demos'&&<PlatformDemoRequests canManage={can('platform.agencies.manage')} onSaved={refreshMetrics} refreshToken={revision}/>}
   {active==='agencies'&&<PlatformRegister kind="agencies" revision={revision} onOpen={openAgency}/>}
   {active==='billing'&&<PlatformBilling revision={revision} openAgency={openAgency}/>}
   {active==='tickets'&&<PlatformRegister kind="support" revision={revision} onOpen={row=>setTicket(String(row.id))}/>}
   {active==='operations'&&<PlatformOperations revision={revision}/>}
   {active==='audit'&&<PlatformRegister kind="audit" revision={revision}/>}
   {active==='operators'&&<PlatformOperators currentUser={currentUser} revision={revision} saved={refreshMetrics}/>}
  </main>
  {agency&&<PlatformAgencySheet key={agency} id={agency} granted={granted} close={()=>setAgency(null)} saved={refreshMetrics}/>}
  {ticket&&<PlatformSupportSheet key={ticket} id={ticket} close={()=>setTicket(null)} saved={refreshMetrics}/>}
 </div>;
}
