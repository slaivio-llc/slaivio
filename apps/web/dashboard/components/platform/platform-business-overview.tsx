import { OperationButton } from '@/components/ui/operation-controls';
import { type PlatformMetrics } from '@/services/platform-admin';
import { demoLabel } from './platform-demo-requests';

function cash(minor:number,currency:string){
  // Platform billing stores every currency in hundredths (same as checkout).
  try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency}).format(minor/100);}
  catch{return `${minor} unités mineures (${currency})`;}
}

export function PlatformBusinessOverview({metrics,openDemos}:{metrics:PlatformMetrics;openDemos:()=>void}) {
  return <div className="grid gap-5 xl:grid-cols-2">
    <Panel title="Acquisition et demandes de démo"><p className="text-sm text-slate-500">{metrics.demos_last_30_days} demande(s) reçue(s) sur les 30 derniers jours.</p><dl className="mt-5 grid grid-cols-2 gap-4">{metrics.demo_statuses.map(item=><div key={item.status} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{demoLabel(item.status)}</dt><dd className="mt-1 text-xl font-semibold text-slate-800">{item.count}</dd></div>)}</dl>{!metrics.demo_statuses.length&&<p className="py-5 text-sm text-slate-500">Aucune demande reçue pour le moment.</p>}<OperationButton className="mt-5" onClick={openDemos}>Voir les demandes de démo</OperationButton></Panel>
    <Panel title="Encaissements des abonnements"><p className="text-xs leading-5 text-slate-500">Factures SLAIVIO confirmées payées, séparées par devise. Les paiements des clients des agences ne sont pas inclus. Ce montant n’est pas un revenu mensuel récurrent prévisionnel.</p>{metrics.revenues_by_currency.length?<dl className="mt-4 space-y-3">{metrics.revenues_by_currency.map(item=><div key={item.currency_code} className="rounded-lg border border-slate-200 p-3"><dt className="text-xs text-slate-500">{item.currency_code} · Total enregistré</dt><dd className="mt-1 text-xl font-semibold text-slate-800">{cash(item.collected_minor,item.currency_code)}</dd><p className="mt-1 text-xs text-slate-500">Ce mois : {cash(item.month_collected_minor,item.currency_code)}</p></div>)}</dl>:<p className="py-5 text-sm text-slate-500">Aucun encaissement confirmé.</p>}</Panel>
    <Panel title="Activité opérationnelle"><p className="mb-4 text-xs text-slate-500">Colis et expéditions : mois civil UTC en cours. Espaces et membres : situation actuelle.</p><dl className="grid grid-cols-2 gap-4">{[['Colis enregistrés',metrics.packages_month],['Expéditions créées',metrics.shipments_month],['Espaces rattachés actifs',metrics.active_offices],['Comptes membres distincts actifs',metrics.active_users]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-2xl font-semibold text-slate-800">{value}</dd></div>)}</dl></Panel>
    <Panel title="Forfaits payants en cours">{metrics.plan_distribution.length?<dl className="space-y-3">{metrics.plan_distribution.map(item=><div key={item.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"><dt className="text-sm text-slate-700">{item.code==='ENTERPRISE'||item.code==='BUSINESS'?'Business':item.name}</dt><dd className="font-semibold text-slate-800">{item.count}</dd></div>)}</dl>:<p className="text-sm text-slate-500">Aucun abonnement payant en cours.</p>}<p className="mt-4 text-xs leading-5 text-slate-500">Les essais et les abonnements expirés ne sont pas comptés comme payants.</p></Panel>
  </div>;
}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>{children}</section>;}
