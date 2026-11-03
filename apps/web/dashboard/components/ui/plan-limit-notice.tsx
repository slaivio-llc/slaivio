'use client';
import Link from 'next/link';
import {Info} from 'lucide-react';
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

export function PlanLimitNotice({message}:{message:string}){
 useDashboardMessages();
 return <div role="status" className="rounded-xl border border-[#dce5df] bg-[#f5f9f6] px-4 py-3 text-[13px] text-[#405e4b]">
  <p className="flex items-center gap-2 font-semibold"><Info size={16} aria-hidden="true"/>{dashboardText('Capacité de votre offre')}</p>
  <p className="mt-2 leading-5">{dashboardText(message)}</p>
  <Link href="/app/settings?section=subscription" className="mt-3 inline-flex font-semibold text-[#087c4b] underline underline-offset-2">{dashboardText('Consulter les offres')}</Link>
 </div>;
}
