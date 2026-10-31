'use client';
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import { useEffect, useState } from 'react';
import { platformOperations, type OperationSummary } from '@/services/platform-admin';
import { LoadingState } from '@/components/ui/page-state';
import { Alert, Panel, Status } from './platform-console-ui';
import { PlatformRegister } from './platform-register';

export function PlatformOperations({revision}:{revision:number}){
  useDashboardMessages();
 const [data,setData]=useState<OperationSummary|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;platformOperations().then(value=>{if(active){setData(value);setError('');}}).catch(()=>{if(active)setError('Le suivi technique n’a pas pu être chargé. Aucune disponibilité ne peut être déduite.');});return()=>{active=false;};},[revision]);
 return <div className="grid gap-5"><p className="text-sm leading-6 text-[#69747f]">{dashboardText("État enregistré des communications et automatisations, pas une mesure de disponibilité des fournisseurs. Les reprises et affectations techniques nécessitent une procédure opérateur contrôlée.")}</p>{error&&<Alert>{dashboardText(error)}</Alert>}{!data&&!error&&<LoadingState label={dashboardText("Chargement du suivi technique…")}/>}{data&&<><div className="grid gap-5 lg:grid-cols-2">{([[dashboardText("Communications clients"),data.notifications],[dashboardText("Automatisations du parcours client"),data.automations]] as const).map(([title,rows])=><Panel key={title} title={title} description={dashboardText("Répartition cumulée des traitements enregistrés.")}><ul className="grid gap-3">{rows.map(row=><li key={row.status} className="flex items-center justify-between gap-3"><Status value={row.status}/><strong className="text-lg font-semibold">{row.count}</strong></li>)}</ul>{!rows.length&&<p className="text-sm text-[#69747f]">{dashboardText("Aucun traitement enregistré.")}</p>}</Panel>)}</div><Panel title={dashboardText("Automatisations en attente prolongée")}><p className="text-2xl font-semibold text-[#087a46]">{data.overdue_automations}</p><p className="mt-2 text-xs text-[#69747f]">{dashboardText("Événements encore en attente plus de 15 minutes après leur échéance. Cet indicateur ne suffit pas à conclure qu’un service est arrêté.")}</p></Panel></>}<PlatformRegister kind="quarantine" revision={revision}/></div>;
}
