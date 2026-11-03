'use client';
import {dashboardText,useDashboardMessages,dashboardFormatLocale} from '@/components/i18n/dashboard-messages';
import type {BillingOverview} from '@/services/subscription-billing';

const labels:Record<string,string>={max_monthly_packages:'Colis créés par mois',max_users:'Membres de votre équipe',max_offices:'Bureaux',max_warehouses:'Entrepôts',max_whatsapp_numbers:'Numéros WhatsApp'};
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString(dashboardFormatLocale()):'';

export function SubscriptionCapacity({capacity,onManage}:{capacity:NonNullable<BillingOverview['capacity']>;onManage:()=>void}){
 useDashboardMessages();
 const trial=capacity.trial_active===true;
 return <section aria-label={dashboardText('Capacité de votre offre')}>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-[14px] font-medium">{dashboardText('Capacité de votre offre')}</h3><button type="button" onClick={onManage} className="rounded-full bg-[#f3f4f3] px-4 py-2 text-[13px] font-medium">{dashboardText(trial?'Consulter les offres':'Augmenter ma capacité')}</button></div>
  {trial&&<p className="mb-4 rounded-lg bg-[#eef8f2] p-3 text-[13px] leading-5 text-[#286342]">{dashboardText('Sans limite pendant l’essai gratuit. Les plafonds de l’offre choisie s’appliqueront ensuite. Vos données seront conservées.')}{capacity.trial_ends_at&&<> {dashboardText('Fin de l’essai : ')}{date(capacity.trial_ends_at)}.</>}</p>}
  <div className="grid gap-5 rounded-xl border border-[#e4e7e9] p-4 sm:grid-cols-2">{Object.entries(labels).map(([key,label])=>{
   const limit=capacity.limits[key];if(!trial&&(!limit||limit<0))return null;
   const used=capacity.usage[key]||0, warning=!trial&&typeof limit==='number'&&used>=limit*.8;
   return <div key={key}><div className="flex justify-between gap-3 text-[12px]"><span>{dashboardText(label)}</span><span className={warning?'font-medium text-amber-800':'text-[#697178]'}>{used.toLocaleString(dashboardFormatLocale())} / {trial?dashboardText('Sans limite'):limit!.toLocaleString(dashboardFormatLocale())}</span></div>
    {!trial&&typeof limit==='number'&&<progress aria-label={dashboardText(label)} max={limit} value={Math.min(used,limit)} className="mt-2 h-1.5 w-full accent-[#18794e]"/>}
    {warning&&<p className="mt-1 text-[12px] text-amber-800">{used>=limit!?dashboardText('Limite atteinte. Les éléments existants restent accessibles.'):dashboardText('Vous avez utilisé au moins 80 % de cette capacité.')}</p>}
   </div>;
  })}</div>
  {!trial&&<p className="mt-3 text-[12px] leading-5 text-[#697178]">{dashboardText('Colis : renouvellement le ')}{date(capacity.period_ends_at)} ({capacity.timezone}{dashboardText('). Supprimer un colis ne restitue pas de capacité. Les plafonds sont partagés entre tous les bureaux et entrepôts de l’agence.')}</p>}
  {!trial&&capacity.transition_active&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">{dashboardText('Période de transition jusqu’au ')}{date(capacity.enforce_from)} {dashboardText(' : ces nouveaux plafonds ne bloquent pas encore votre agence. Vos données sont conservées.')}</p>}
 </section>;
}
