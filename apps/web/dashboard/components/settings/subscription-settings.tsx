"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { FormSection, OperationButton } from "@/components/ui/operation-controls";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiErrorDetail } from "@/services/api";
import { createSubscriptionCheckout, getSubscriptionBilling, getSubscriptionPlans, openSubscriptionCheckout, verifySubscriptionCheckout, type BillingOverview, type SubscriptionPlan } from "@/services/subscription-billing";

const input="h-10 w-full rounded-lg border border-[#d8dddf] bg-white px-3 text-[14px] text-[#30363a]";
const money=(minor:number,currency:string)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency}).format(minor/100);
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('fr-FR'):'Non définie';

export function SubscriptionSettings({organization}:{organization:Record<string,unknown>}){
  const params=useSearchParams();
  const returnedCheckout=params.get('checkout');
  const [billing,setBilling]=useState<BillingOverview|null>(null);
  const [plans,setPlans]=useState<SubscriptionPlan[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState('');
  const [selectedPlan,setSelectedPlan]=useState('');
  const load=useCallback(async()=>{
    const [data,catalog]=await Promise.all([getSubscriptionBilling(),getSubscriptionPlans()]);
    setBilling(data);setPlans(catalog);setSelectedPlan(current=>data.pending_checkout?.plan_code||current||data.subscription?.plan_code||'STARTER');
    return data;
  },[]);
  useEffect(()=>{
    let active=true;
    void load().then(async data=>{
      if(!active)return;
      const key=`slaivio:subscription-checkout:${data.billing_account_id}`;
      const id=returnedCheckout||data.pending_checkout?.id||window.sessionStorage.getItem(key);
      if(!id)return;
      setPending(id);setBusy(true);
      try{
        const result=await verifySubscriptionCheckout(id);
        if(!active)return;
        if(result.status==='SUCCESS'){
          window.sessionStorage.removeItem(key);setPending('');setNotice('Paiement confirmé. Votre abonnement est actif.');await load();
        }else if(result.status==='FAILED'){
          window.sessionStorage.removeItem(key);setPending('');setNotice('Le paiement n’a pas abouti. Aucun abonnement payant n’a été activé.');
        }else setNotice('Le paiement est en attente de confirmation.');
      }catch(exception){if(active)setError(apiErrorDetail(exception)||'Le paiement n’a pas pu être vérifié.');}
      finally{if(active)setBusy(false);}
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

  if(!billing)return error?<ErrorState title="Abonnement indisponible" description={error} retry={()=>{setError('');void load().catch(()=>setError('Impossible de charger votre abonnement.'));}}/>:<LoadingState label="Chargement de l’abonnement…"/>;
  const subscription=billing.subscription;
  const trial=subscription?.status==='TRIAL';
  const daysLeft=trial&&subscription.trial_ends_at?Math.max(0,Math.ceil((new Date(subscription.trial_ends_at).getTime()-Date.now())/86400000)):0;
  const selected=plans.find(plan=>plan.code===selectedPlan);
  return <div className="grid gap-6" aria-busy={busy}>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-[#f4f6f5] p-3 text-[14px] text-[#30363a]">{notice}</p>}
    <FormSection title={trial?'Essai gratuit de 30 jours':'Votre abonnement'} description="Abonnement à SLAIVIO, distinct des factures de vos clients.">
      <div className="grid gap-3 rounded-lg border border-[#dfe3e4] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[18px]">{subscription?.plan_name||'Starter'}</strong><span className="rounded-full bg-[#f1f3f2] px-3 py-1 text-[13px]">{!billing.access_active?'À renouveler':trial?`${daysLeft} jour${daysLeft>1?'s':''} restant${daysLeft>1?'s':''}`:'Actif'}</span></div>
        <p className="text-[14px] text-[#59636e]">{trial?`Fin de l’essai : ${date(subscription?.trial_ends_at)}`:`Accès jusqu’au : ${date(subscription?.ends_at)}`}</p>
        <p className="text-[13px] text-[#697178]">{trial?'Aucun paiement requis pendant l’essai. Aucun prélèvement automatique.':'Renouvellement manuel. Aucun prélèvement automatique.'}</p>
      </div>
    </FormSection>
    <FormSection title="Souscrire ou renouveler" description="Un paiement confirmé prolonge votre accès d’un mois. Les jours d’essai ou d’abonnement restants sont conservés.">
      {!billing.checkout_available&&<p className="text-[13px] text-[#697178]">Le paiement SasPay est en cours d’activation. Votre essai gratuit reste disponible. Contactez le support SLAIVIO pour toute question.</p>}
      <PermissionGuard permission="organization.manage" fallback={<p className="text-[13px] text-[#697178]">Demandez au responsable de votre agence de gérer l’abonnement.</p>}>
        <form onSubmit={event=>void checkout(event)} className="grid gap-4">
          <fieldset disabled={busy||!billing.checkout_available} className="grid gap-4 disabled:opacity-60">
            <label className="grid gap-2 text-[13px] font-medium">Forfait<select aria-label="Forfait" required className={input} value={selectedPlan} onChange={event=>setSelectedPlan(event.target.value)}>{plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name} — {money(plan.monthly_price_minor,plan.currency_code)} / mois</option>)}</select></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-[13px] font-medium">Nom du payeur<input name="name" required minLength={2} maxLength={120} className={input} defaultValue={String(organization.organization_name||'')}/></label><label className="grid gap-2 text-[13px] font-medium">Email de facturation<input name="email" required type="email" maxLength={254} className={input} defaultValue={String(organization.email||'')}/></label></div>
            <p className="text-[12px] leading-5 text-[#697178]">Vous choisirez votre moyen de paiement sur la page sécurisée SasPay. Les frais éventuels y seront présentés avant validation.</p>
            <OperationButton type="submit" variant="primary" disabled={busy||!selected||!billing.checkout_available}>{busy?'Vérification…':selected?`Payer ${money(selected.monthly_price_minor,selected.currency_code)} avec SasPay`:'Payer avec SasPay'}</OperationButton>
          </fieldset>
        </form>
        {pending&&<OperationButton className="mt-3" disabled={busy} onClick={()=>void verify()}>Vérifier mon paiement</OperationButton>}
      </PermissionGuard>
    </FormSection>
    <FormSection title="Utilisation" description="Activité actuelle de votre agence."><div className="grid grid-cols-2 gap-4">{Object.entries(billing.usage).map(([key,value])=><div key={key}><p className="text-[13px] text-[#697178]">{({clients:'Clients',packages:'Colis',members:'Membres',offices:'Bureaux'} as Record<string,string>)[key]||key}</p><p className="mt-1 text-[18px] font-semibold">{value}</p></div>)}</div></FormSection>
    <FormSection title="Factures d’abonnement" description="Paiements de votre abonnement à la plateforme.">{!billing.invoices.length?<p className="text-[13px] text-[#697178]">Aucune facture pendant l’essai gratuit.</p>:<div className="divide-y divide-[#e7eaec]">{billing.invoices.map(invoice=><div key={invoice.id} className="flex flex-wrap justify-between gap-2 py-3 text-[13px]"><span>{invoice.invoice_number}<span className="mt-1 block text-[#697178]">{({PAID:'Payée',OPEN:'À régler',VOID:'Annulée'} as Record<string,string>)[invoice.status]||'En cours'}</span></span><strong>{money(invoice.total_minor,invoice.currency_code)}</strong></div>)}</div>}</FormSection>
  </div>;
}
