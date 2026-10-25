"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {getSubscriptionStatus} from '@/services/subscription-billing';

export function TrialBanner(){
  const [subscription,setSubscription]=useState<Awaited<ReturnType<typeof getSubscriptionStatus>>|null>(null);
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    let active=true;
    const refresh=()=>{void getSubscriptionStatus().then(value=>{if(active){setSubscription(value);setNow(Date.now());}}).catch(()=>{if(active)setSubscription(null);});};
    refresh();
    const timer=window.setInterval(()=>{if(active)setNow(Date.now());},60000);
    window.addEventListener('focus',refresh);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  if(subscription?.status!=='TRIAL'||!subscription.trial_ends_at)return null;
  const deadline=Date.parse(subscription.trial_ends_at);
  if(!Number.isFinite(deadline))return null;
  const remaining=Math.max(0,Math.ceil((deadline-now)/86400000));
  return <aside data-trial-banner aria-label="Essai gratuit" className="absolute bottom-1 right-3 ml-auto flex min-w-0 items-center gap-2 rounded-md border border-[#eeddb4] bg-[#fff8e8] px-2 py-1.5 text-[12px] text-[#77571c] sm:static sm:px-3">
    <span className="hidden whitespace-nowrap font-medium lg:inline">{remaining?`Essai · ${remaining} jour${remaining>1?'s':''} restant${remaining>1?'s':''}`:'Essai terminé'}</span>
    <span className="whitespace-nowrap font-medium lg:hidden">{remaining?`Essai · ${remaining} j`:'Essai terminé'}</span>
    <Link href="/app/settings?section=subscription" className="hidden whitespace-nowrap rounded border border-[#e4cf9e] bg-white px-2 py-1 font-medium hover:bg-[#fffdf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b2893a] xl:inline-flex">Choisir une offre</Link>
    <Link href="/app/settings?section=subscription" className="xl:hidden" aria-label="Choisir une offre">↗</Link>
  </aside>;
}
