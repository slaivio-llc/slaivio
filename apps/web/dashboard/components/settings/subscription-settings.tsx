"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationButton } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiErrorDetail } from "@/services/api";
import { cancelSubscriptionCheckout, createSubscriptionCheckout, getSubscriptionBilling, getSubscriptionPlans, openSubscriptionCheckout, verifySubscriptionCheckout, type BillingOverview, type SubscriptionPlan } from "@/services/subscription-billing";

const input="h-10 w-full rounded-lg border border-[#d8dddf] bg-white px-3 text-[14px] text-[#30363a]";
const money=(minor:number,currency:string)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(minor/100);
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('fr-FR'):'Non définie';

export function SubscriptionSettings({organization}:{organization:Record<string,unknown>}){
  const params=useSearchParams();
  const returnedCheckout=params.get('checkout');
  const [billing,setBilling]=useState<BillingOverview|null>(null);
  const [plans,setPlans]=useState<SubscriptionPlan[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [checking,setChecking]=useState(false);
  const [pending,setPending]=useState('');
  const [selectedPlan,setSelectedPlan]=useState('');
  const load=useCallback(async()=>{
    const [data,catalog]=await Promise.all([getSubscriptionBilling(),getSubscriptionPlans()]);
    setBilling(data);setPlans(catalog);
    return data;
  },[]);
  useEffect(()=>{
    let active=true;
    void load().then(async data=>{
      if(!active)return;
      const key=`slaivio:subscription-checkout:${data.billing_account_id}`;
      const id=returnedCheckout||data.pending_checkout?.id||window.sessionStorage.getItem(key);
      if(!id)return;
      setPending(id);setChecking(true);
      try{
        const result=await verifySubscriptionCheckout(id);
        if(!active)return;
        if(result.status==='SUCCESS'){
          window.sessionStorage.removeItem(key);setPending('');setNotice('Paiement confirmé. Votre abonnement est actif.');await load();
        }else if(result.status==='FAILED'){
          window.sessionStorage.removeItem(key);setPending('');setNotice('Le paiement n’a pas abouti. Aucun abonnement payant n’a été activé.');await load();
        }else setNotice('Le paiement est en attente de confirmation.');
      }catch(exception){if(active)setError(apiErrorDetail(exception)||'Le paiement n’a pas pu être vérifié.');}
      finally{if(active)setChecking(false);}
    }).catch(exception=>{if(active)setError(apiErrorDetail(exception)||'Impossible de charger votre abonnement.');});
    return()=>{active=false;};
  },[load,returnedCheckout]);

  async function verify(){
    if(!billing||!pending)return;
    setBusy(true);setError('');
    try{
      const result=await verifySubscriptionCheckout(pending);
      setNotice(result.status==='SUCCESS'?'Paiement confirmé. Votre abonnement est actif.':result.status==='FAILED'?'Le paiement n’a pas abouti.':'Paiement encore en attente. Validez-le sur la page SasPay.');
      if(result.status!=='PENDING'){
        window.sessionStorage.removeItem(`slaivio:subscription-checkout:${billing.billing_account_id}`);setPending('');await load();
      }
    }catch(exception){setError(apiErrorDetail(exception)||'Le paiement n’a pas pu être vérifié.');}
    finally{setBusy(false);}
  }

  async function checkout(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!billing)return;
    const form=new FormData(event.currentTarget);setBusy(true);setError('');setNotice('');
    try{
      const result=await createSubscriptionCheckout({plan_code:selectedPlan,customer_email:String(form.get('email')||'').trim(),customer_name:String(form.get('name')||'').trim()});
      window.sessionStorage.setItem(`slaivio:subscription-checkout:${billing.billing_account_id}`,result.id);setPending(result.id);
      openSubscriptionCheckout(result.checkout_url);
    }catch(exception){setError(apiErrorDetail(exception)||'Le paiement n’a pas pu être préparé.');setBusy(false);}
  }

  async function cancel(){
    if(!billing||!pending||busy)return;
    setBusy(true);setError('');
    try{
      await cancelSubscriptionCheckout(pending);
      window.sessionStorage.removeItem(`slaivio:subscription-checkout:${billing.billing_account_id}`);
      setPending('');setNotice('L’ancien paiement a été annulé. Vous pouvez choisir votre offre au tarif actuel.');await load();
    }catch(exception){setError(apiErrorDetail(exception)||'L’annulation n’a pas pu être confirmée.');}
    finally{setBusy(false);}
  }

  if(!billing)return error?<ErrorState title="Abonnement indisponible" description={error} retry={()=>{setError('');void load().catch(()=>setError('Impossible de charger votre abonnement.'));}}/>:<LoadingState label="Chargement de l’abonnement…"/>;
  const subscription=billing.subscription;
  const trial=subscription?.status==='TRIAL';
  const daysLeft=trial&&subscription.trial_ends_at?Math.max(0,Math.ceil((new Date(subscription.trial_ends_at).getTime()-Date.now())/86400000)):0;
  const selected=plans.find(plan=>plan.code===selectedPlan);
  const paymentPrice=selected?money(selected.monthly_price_minor,selected.currency_code):'';
  const currentName=subscription?.plan_code==='ENTERPRISE'?'Business':subscription?.plan_name||'Starter';
  return <div className="grid gap-8 text-[#20252a]" aria-busy={busy||checking}>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-[#f4f6f5] p-3 text-[14px] text-[#30363a]">{notice}</p>}
    {checking&&<p role="status" className="text-[13px] text-[#697178]">Vérification de l’ancien paiement… Vous pouvez déjà comparer les offres.</p>}
    {pending&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e4e7] p-4 text-[13px]"><p className="max-w-xl leading-6 text-[#697178]">Un ancien paiement est en attente. Vous pouvez l’annuler ou choisir une offre : avant tout nouveau paiement, la session précédente sera vérifiée et annulée si elle n’est pas déjà payée ou en cours de traitement.</p><OperationButton disabled={busy} onClick={()=>void cancel()}>Annuler l’ancien paiement</OperationButton></div>}
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#e4e7e9] bg-[#f8f9fa] p-5 sm:p-6" aria-label="Abonnement actuel">
      <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[12px] font-medium uppercase tracking-wider text-[#737b83]">Votre offre · {currentName}</span><span className="rounded-full border border-[#dce4df] bg-white px-2.5 py-1 text-[12px] font-medium">{!billing.access_active?'À renouveler':trial?'Essai en cours':'Actif'}</span></div>
        <h3 className="text-[21px] font-semibold tracking-tight">{trial?'Essai gratuit de 30 jours':'Votre espace, votre abonnement'}</h3>
        <p className="mt-2 text-[14px] leading-6 text-[#636d76]">{trial?'Aucun paiement requis pendant l’essai. Aucun prélèvement automatique.':'Un renouvellement mensuel, sans prélèvement automatique.'}</p>
      </div>
      <div className="min-w-[180px] text-left sm:text-right"><p className="text-[23px] font-semibold tracking-tight">{trial?`${daysLeft} jours restants`:date(subscription?.ends_at)}</p><p className="mt-1 text-[13px] text-[#737b83]">{trial?`Fin de l’essai : ${date(subscription?.trial_ends_at)}`:'Date de fin d’accès'}</p>{trial&&<div role="progressbar" aria-label="Jours d’essai restants" aria-valuenow={Math.min(30,daysLeft)} aria-valuemin={0} aria-valuemax={30} className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2e6e4]"><div className="h-full rounded-full bg-[#18794e]" style={{width:`${Math.min(100,daysLeft/30*100)}%`}}/></div>}</div>
    </section>
    <section aria-labelledby="subscription-offers-title">
      <div className="mb-6"><h3 id="subscription-offers-title" className="text-[24px] font-semibold tracking-tight">Une offre adaptée à votre agence</h3><p className="mt-2 text-[14px] leading-6 text-[#697178]">Tarifs mensuels par agence. Choisissez votre offre, puis réglez en toute sécurité.</p></div>
      {!billing.checkout_available&&<p className="mb-5 rounded-xl border border-[#e4e7e9] p-4 text-[14px] text-[#697178]">Le paiement SasPay est en cours d’activation. Votre essai gratuit reste disponible. Contactez le support SLAIVIO pour toute question.</p>}
      <PermissionGuard permission="organization.manage" fallback={<p className="text-[13px] text-[#697178]">Demandez au responsable de votre agence de gérer l’abonnement.</p>}>
        <div className="grid gap-4 xl:grid-cols-3">
          {[...plans].sort((a,b)=>a.monthly_price_minor-b.monthly_price_minor).map(plan=>{
            const pro=plan.code==='PRO';
            const name=plan.code==='ENTERPRISE'?'Business':plan.name;
            const chosen=selectedPlan===plan.code;
            const current=subscription?.plan_code===plan.code;
            const description=plan.code==='STARTER'?'Les bases pour structurer votre activité cargo.':pro?'Pour accompagner le développement de votre agence.':'Pour les équipes et les activités à grande échelle.';
            const features=plan.included_features||[];
            return <article key={plan.code} aria-label={`Offre ${name}`} className="relative flex flex-col rounded-2xl border border-[#e0e4e7] bg-white p-5 transition-colors hover:border-[#18794e] hover:bg-[#f7fbf9]">
              <div className="mb-4 flex min-h-6 items-center justify-between gap-2"><h4 className="text-[19px] font-semibold">{name}</h4>{current?<span className="rounded-md bg-[#edf0f2] px-2 py-1 text-[11px] font-medium">{trial?'En essai':'Offre actuelle'}</span>:pro?<span className="rounded-md bg-[#252b30] px-2 py-1 text-[11px] font-medium text-white">Pour grandir</span>:null}</div>
              <p className="min-h-12 text-[13px] leading-6 text-[#697178]">{description}</p>
              <div className="mb-1 mt-6"><strong className="text-[32px] font-semibold tracking-tight">{money(plan.monthly_price_minor,plan.currency_code)}</strong><span className="ml-1 text-[13px] text-[#737b83]">/ mois</span></div><p className="mb-6 text-[12px] text-[#737b83]">Par agence · {plan.currency_code}</p>
              <button type="button" aria-pressed={chosen} disabled={busy} onClick={()=>setSelectedPlan(plan.code)} className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d6dce0] text-[14px] font-medium transition-colors hover:border-[#18794e] hover:bg-[#18794e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18794e] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${chosen?'bg-[#eff8f3] text-[#18794e]':'bg-white text-[#30363a]'}`}>{chosen?<><Check size={16}/>Offre sélectionnée</>:<>{current&&!trial?'Renouveler':`Choisir ${name}`}<ArrowRight size={15}/></>}</button>
              {features.length>0&&<ul className="mt-6 grid gap-3 border-t border-[#e4e7e9] pt-5 text-[13px] text-[#59636e]">{features.map(feature=><li key={feature} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#18794e]"/>{feature}</li>)}</ul>}
            </article>;
          })}
        </div>
        {selected&&<form onSubmit={event=>void checkout(event)} className="mt-6 grid gap-6 rounded-2xl border border-[#e0e4e7] p-5 sm:p-6" aria-label="Finaliser l’abonnement">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ebed] pb-5"><div><h3 className="text-[17px] font-semibold">Finaliser votre abonnement</h3><p className="mt-1 text-[13px] text-[#697178]">{selected.code==='ENTERPRISE'?'Business':selected.name} · 1 mois d’accès</p></div><strong className="text-[24px] font-semibold">{paymentPrice}</strong></div>
          <fieldset disabled={busy||!billing.checkout_available} className="grid gap-4 disabled:opacity-60">
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-[13px] font-medium">Nom du payeur<input name="name" required minLength={2} maxLength={120} className={input} defaultValue={String(organization.organization_name||'')}/></label><label className="grid gap-2 text-[13px] font-medium">Email de facturation<input name="email" required type="email" maxLength={254} className={input} defaultValue={String(organization.email||'')}/></label></div>
            <p className="text-[13px] leading-6 text-[#697178]">Les jours d’essai ou d’abonnement restants sont conservés. Les éventuels frais de paiement sont présentés par SasPay avant validation.</p>
            <button type="submit" disabled={busy||!billing.checkout_available} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#20262b] px-5 text-[14px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={16}/>{busy?'Vérification…':`Payer ${paymentPrice} avec SasPay`}<ArrowRight size={16}/></button>
            <p className="flex items-center justify-center gap-2 text-[12px] text-[#737b83]"><ShieldCheck size={14}/>Paiement sécurisé · Aucun prélèvement automatique</p>
          </fieldset>
        </form>}
        {pending&&<OperationButton className="mt-3" disabled={busy} onClick={()=>void verify()}>Vérifier mon paiement</OperationButton>}
      </PermissionGuard>
    </section>
    <div className="grid gap-6 border-t border-[#e4e7e9] pt-7 sm:grid-cols-2">
      <section><h3 className="mb-4 text-[16px] font-semibold">Utilisation de l’agence</h3><div className="grid grid-cols-2 gap-4">{Object.entries(billing.usage).map(([key,value])=><div key={key}><p className="text-[13px] text-[#697178]">{({clients:'Clients',packages:'Colis',members:'Membres',offices:'Bureaux'} as Record<string,string>)[key]||key}</p><p className="mt-1 text-[22px] font-semibold">{value}</p></div>)}</div></section>
      <section><h3 className="mb-4 text-[16px] font-semibold">Factures d’abonnement</h3>{!billing.invoices.length?<p className="text-[13px] leading-6 text-[#697178]">Aucune facture pendant l’essai gratuit.</p>:<div className="divide-y divide-[#e7eaec]">{billing.invoices.map(invoice=><div key={invoice.id} className="flex flex-wrap justify-between gap-2 py-3 text-[13px]"><span>{invoice.invoice_number}<span className="mt-1 block text-[#697178]">{({PAID:'Payée',OPEN:'À régler',VOID:'Annulée'} as Record<string,string>)[invoice.status]||'En cours'}</span></span><strong>{money(invoice.total_minor,invoice.currency_code)}</strong></div>)}</div>}</section>
    </div>
  </div>;
}
