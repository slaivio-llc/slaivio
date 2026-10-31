'use client';
import {dashboardText,useDashboardMessages,dashboardFormatLocale} from '@/components/i18n/dashboard-messages';

import { useEffect, useState } from 'react';
import { OperationButton } from '@/components/ui/operation-controls';
import { platformPlans, type ConsoleRow, type PlatformPlan } from '@/services/platform-admin';
import { Alert, money, Panel } from './platform-console-ui';
import { PlatformRegister } from './platform-register';

export const resources:Record<string,string>={max_monthly_packages:'colis par mois',max_users:'membres',max_offices:'bureaux',max_warehouses:'entrepôts',max_whatsapp_numbers:'numéros WhatsApp',max_monthly_messages:'messages par mois',max_ai_requests:'demandes IA par mois'};
export function PlatformBilling({revision,openAgency}:{revision:number;openAgency:(row:ConsoleRow)=>void}){
  useDashboardMessages();
 const [view,setView]=useState<'subscriptions'|'invoices'|'checkouts'|'plans'>('subscriptions'),[plans,setPlans]=useState<PlatformPlan[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;if(view==='plans')platformPlans().then(value=>{if(active){setPlans(value);setError('');}}).catch(()=>{if(active)setError('Impossible de charger le catalogue des forfaits.');});return()=>{active=false;};},[view,revision]);
 return <div className="grid gap-5"><nav aria-label={dashboardText("Sections facturation")} className="flex flex-wrap gap-2">{([['subscriptions',dashboardText("Abonnements")],['invoices',dashboardText("Factures SLAIVIO")],['checkouts',dashboardText("Paiements SasPay")],['plans',dashboardText("Forfaits et limites")]] as const).map(([id,title])=><OperationButton key={id} variant={view===id?'primary':'secondary'} onClick={()=>setView(id)} aria-pressed={view===id}>{title}</OperationButton>)}</nav>{view!=='plans'?<PlatformRegister key={view} kind={view} revision={revision} onOpen={openAgency}/>:<><p className="text-sm text-[#69747f]">{dashboardText("Catalogue et limites réellement configurés. La modification des prix passe par une migration contrôlée, pas par une action immédiate sur les agences.")}</p>{error&&<Alert>{dashboardText(error)}</Alert>}<div className="grid gap-4 lg:grid-cols-3">{plans.map(plan=><Panel key={plan.id} title={plan.code==='ENTERPRISE'?dashboardText("Business"):plan.name} description={plan.active?dashboardText("Forfait actif au catalogue"):dashboardText("Forfait inactif")}><p className="text-2xl font-semibold text-[#087a46]">{money(plan.monthly_price_minor,plan.currency_code)}<span className="ml-1 text-xs font-normal text-[#69747f]">{dashboardText("/ mois")}</span></p><ul className="mt-4 grid gap-2 text-sm">{Object.entries(plan.limits).map(([resource,value])=><li key={resource}>{value.toLocaleString(dashboardFormatLocale())} {dashboardText(resources[resource])||dashboardText("unités pour une capacité spécifique")}</li>)}</ul></Panel>)}</div></>}</div>;
}
