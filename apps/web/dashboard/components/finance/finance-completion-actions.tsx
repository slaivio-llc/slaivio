/* eslint-disable react-hooks/exhaustive-deps -- load synchronizes the currently selected server document after mutations. */
"use client";
import {FormEvent,useEffect,useState} from "react";
import {PermissionGuard} from "@/components/permissions/permission-guard";
import {OperationDrawer} from "@/components/ui/operation-drawer";
import {LoadingState} from "@/components/ui/page-state";
import {applyCredit,convertQuote,decideQuote,financePrint,getFinanceSettings,listFinance,listFinanceDuePolicies,reverseFinancePayment,saveFinanceDuePolicy,saveFinanceSettings,type FinanceDocument,type FinanceDuePolicy,type FinanceSettings} from "@/services/finance";
const button="inline-flex h-9 items-center justify-center rounded-[5px] border border-[#d9dcdf] bg-white px-3 text-[13px] font-medium hover:bg-[#f5f6f6] disabled:opacity-50",primary="inline-flex h-9 items-center justify-center rounded-[5px] bg-[#16855f] px-3 text-[13px] font-semibold text-white disabled:opacity-50",input="h-9 w-full rounded-[5px] border border-[#d8dce0] px-3 text-[13px]";
export function FinanceCompletionActions({item,busy,run}:{item:FinanceDocument;busy:boolean;run:(fn:()=>Promise<unknown>)=>void}){async function print(){const markup=await financePrint(item.id),w=window.open("","_blank");if(w){w.document.write(markup);w.document.close()}}async function apply(){const invoices=await listFinance({document_type:"INVOICE",status:"ISSUED",page_size:100}),choices=invoices.items.filter(x=>x.client_id===item.client_id&&x.currency===item.currency);const number=window.prompt(`Facture cible : ${choices.map(x=>x.document_number).join(", ")}`);const invoice=choices.find(x=>x.document_number===number);if(invoice)await applyCredit(item.id,item.row_version,invoice.id)}return <div className="flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={print}>Imprimer / PDF</button>{item.document_type==='QUOTE'&&item.status==='ISSUED'?<PermissionGuard permission="finance.issue"><button disabled={busy} className={primary} onClick={()=>run(()=>decideQuote(item.id,item.row_version,true))}>Accepter</button><button disabled={busy} className={button} onClick={()=>{const reason=window.prompt("Motif du refus");run(()=>decideQuote(item.id,item.row_version,false,reason))}}>Refuser</button></PermissionGuard>:null}{item.document_type==='QUOTE'&&item.status==='ACCEPTED'?<PermissionGuard permission="finance.create"><button disabled={busy} className={primary} onClick={()=>run(()=>convertQuote(item.id,item.row_version))}>Convertir en facture</button></PermissionGuard>:null}{item.document_type==='CREDIT_NOTE'&&item.status==='ISSUED'?<PermissionGuard permission="finance.payments"><button disabled={busy} className={primary} onClick={()=>run(apply)}>Appliquer l’avoir</button></PermissionGuard>:null}</div>}
export function PaymentReverseButton({documentId,paymentId,onRun}:{documentId:string;paymentId:string;onRun:(fn:()=>Promise<unknown>)=>void}){return <PermissionGuard permission="finance.reverse_payment"><button className="text-[12px] text-red-600" onClick={()=>{const reason=window.prompt("Motif obligatoire de l’annulation");if(reason)onRun(()=>reverseFinancePayment(documentId,paymentId,reason))}}>Annuler l’encaissement</button></PermissionGuard>}
export function FinanceSettingsModal({close}:{close:()=>void}){
  const [data,setData]=useState<FinanceSettings|null>(null);
  const [policies,setPolicies]=useState<FinanceDuePolicy[]>([]);
  const [error,setError]=useState("");
  const [policyRuleType,setPolicyRuleType]=useState<FinanceDuePolicy["rule_type"]>("PERCENTAGE");

  useEffect(()=>{
    Promise.all([getFinanceSettings(),listFinanceDuePolicies()])
      .then(([settings,policyList])=>{setData(settings);setPolicies(policyList);})
      .catch(()=>setError("Paramètres indisponibles."));
  },[]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    try{
      await saveFinanceSettings({
        legal_name:String(f.get("legal_name"))||null,
        tax_identifier:String(f.get("tax_identifier"))||null,
        billing_address:String(f.get("billing_address"))||null,
        default_currency:String(f.get("default_currency")).toUpperCase(),
        default_tax_rate:Number(f.get("default_tax_rate")),
        default_payment_terms_days:Number(f.get("default_payment_terms_days")),
        document_footer:String(f.get("document_footer"))||null,
      });
      close();
    }catch{
      setError("Enregistrement impossible.");
    }
  }

  async function submitPolicy(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    try{
      const name=String(f.get("policy_name")||"").trim();
      const trigger_event=String(f.get("trigger_event")) as FinanceDuePolicy["trigger_event"];
      const rule_type=String(f.get("rule_type")) as FinanceDuePolicy["rule_type"];
      const percentageValue=Number(f.get("percentage"));
      const fixedAmountValue=Number(f.get("fixed_amount"));
      const payload:FinanceDuePolicy={
        name,
        trigger_event,
        rule_type,
        percentage: rule_type === "PERCENTAGE" ? percentageValue : null,
        fixed_amount: rule_type === "FIXED_AMOUNT" ? fixedAmountValue : null,
        currency:String(f.get("policy_currency")||data?.default_currency||"USD").toUpperCase(),
        is_active:true,
      };
      if(!name) throw new Error("missing_name");
      if(rule_type === "PERCENTAGE" && (!Number.isFinite(percentageValue) || percentageValue < 0 || percentageValue > 100)) throw new Error("invalid_percentage");
      if(rule_type === "FIXED_AMOUNT" && (!Number.isFinite(fixedAmountValue) || fixedAmountValue <= 0)) throw new Error("invalid_fixed_amount");
      await saveFinanceDuePolicy(payload);
      const fresh=await listFinanceDuePolicies();
      setPolicies(fresh);
      setError("");
      (e.currentTarget as HTMLFormElement).reset();
      setPolicyRuleType("PERCENTAGE");
    }catch{
      setError("Règle d’exigibilité impossible à enregistrer.");
    }
  }

  return <OperationDrawer open close={close} title="Paramètres de facturation" description="Identité légale, fiscalité, échéances par défaut et règles d’exigibilité." width="max-w-[760px]">{data ? <div className="space-y-6"><form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-[12px] font-medium">Raison sociale<input name="legal_name" className={input} defaultValue={data.legal_name||""}/></label><label className="grid gap-1.5 text-[12px] font-medium">Identifiant fiscal<input name="tax_identifier" className={input} defaultValue={data.tax_identifier||""}/></label></div><label className="grid gap-1.5 text-[12px] font-medium">Adresse de facturation<textarea name="billing_address" className="min-h-[72px] rounded-[5px] border border-[#d8dce0] p-3 text-[13px]" defaultValue={data.billing_address||""}/></label><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1.5 text-[12px] font-medium">Devise<input required name="default_currency" maxLength={3} className={input} defaultValue={data.default_currency}/></label><label className="grid gap-1.5 text-[12px] font-medium">Taxe par défaut (%)<input required name="default_tax_rate" type="number" min="0" max="100" step="0.01" className={input} defaultValue={data.default_tax_rate}/></label><label className="grid gap-1.5 text-[12px] font-medium">Échéance (jours)<input required name="default_payment_terms_days" type="number" min="0" max="365" className={input} defaultValue={data.default_payment_terms_days}/></label></div><label className="grid gap-1.5 text-[12px] font-medium">Pied de page des documents<textarea name="document_footer" className="min-h-[72px] rounded-[5px] border border-[#d8dce0] p-3 text-[13px]" defaultValue={data.document_footer||""}/></label><div className="flex justify-end gap-2 border-t pt-4"><button type="button" className={button} onClick={close}>Annuler</button><button className={primary}>Enregistrer les paramètres</button></div></form><section className="rounded-[8px] border border-[#d8dce0] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-semibold">Règles d’exigibilité</h3><span className="text-[11px] text-[#68717d]">Versionnées, traçables et non universelles</span></div><form onSubmit={submitPolicy} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1.5 text-[12px] font-medium">Nom<input name="policy_name" className={input} placeholder="Ex. Réception 50%" required/></label><label className="grid gap-1.5 text-[12px] font-medium">Déclenchement<select name="trigger_event" className={input} defaultValue="RECEPTION"><option value="RECEPTION">Réception</option><option value="ARRIVAL">Arrivée</option><option value="DELIVERY">Livraison</option><option value="MANUAL">Manuelle</option></select></label><label className="grid gap-1.5 text-[12px] font-medium">Devise<input name="policy_currency" className={input} defaultValue={data.default_currency} maxLength={3}/></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-[12px] font-medium">Type<select name="rule_type" className={input} value={policyRuleType} onChange={(e)=>setPolicyRuleType(e.target.value as FinanceDuePolicy["rule_type"])}><option value="PERCENTAGE">Pourcentage</option><option value="FIXED_AMOUNT">Montant fixe</option></select></label><label className="grid gap-1.5 text-[12px] font-medium">Valeur{policyRuleType === "PERCENTAGE" ? <input name="percentage" type="number" min="0" max="100" step="0.01" className={input} placeholder="50"/> : <input name="fixed_amount" type="number" min="0" step="0.01" className={input} placeholder="25.00"/>}</label></div><div className="flex justify-end"><button type="submit" className={primary}>Enregistrer la règle</button></div></form>{error ? <p className="mt-3 rounded-[5px] bg-red-50 p-3 text-[12px] text-red-700">{error}</p> : null}{policies.length > 0 ? <div className="mt-4 space-y-2">{policies.map((policy)=><div key={policy.id||policy.name} className="flex items-center justify-between rounded-[6px] border border-[#e7ebef] bg-[#f9fafb] p-3 text-[12px]"><div><b className="block">{policy.name}</b><span className="text-[#68717d]">{policy.trigger_event} · {policy.rule_type === "PERCENTAGE" ? `${policy.percentage ?? 0}%` : `${policy.fixed_amount ?? 0} ${policy.currency}`}</span></div><span className={`rounded-full px-2 py-1 ${policy.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{policy.is_active ? "Active" : "Inactive"}</span></div>)}</div> : <p className="mt-3 text-[12px] text-[#68717d]">Aucune règle d’exigibilité définie pour cette organisation.</p>}</section></div> : error ? <p className="rounded-[5px] bg-red-50 p-3 text-[12px] text-red-700">{error}</p> : <LoadingState label="Chargement des paramètres…"/>}</OperationDrawer>;
}
export function FinanceCommandCenter(){const [open,setOpen]=useState(false),[settings,setSettings]=useState(false),[items,setItems]=useState<FinanceDocument[]>([]),[selected,setSelected]=useState<FinanceDocument|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");async function load(){const r=await listFinance({page_size:100});setItems(r.items);if(selected){const next=r.items.find(x=>x.id===selected.id);if(next)setSelected(next)}}useEffect(()=>{if(open)load()},[open]);async function run(fn:()=>Promise<unknown>){setBusy(true);setError("");try{await fn();await load()}catch(e){setError((e as {response?:{data?:{detail?:string}}})?.response?.data?.detail||"Action impossible.")}finally{setBusy(false)}}return <><div className="fixed bottom-5 right-5 z-40 flex gap-2"><PermissionGuard permission="finance.settings"><button className={button} onClick={()=>setSettings(true)}>Paramètres fiscaux</button></PermissionGuard><button className={primary} onClick={()=>setOpen(true)}>Actions financières</button></div><OperationDrawer open={open} close={()=>setOpen(false)} title="Actions financières" description="Sélectionnez un document pour accéder aux actions disponibles." width="max-w-[620px]"><label className="grid gap-1.5 text-[12px] font-medium">Document<select className={input} value={selected?.id||""} onChange={e=>setSelected(items.find(x=>x.id===e.target.value)||null)}><option value="">Choisir un document</option>{items.map(x=><option key={x.id} value={x.id}>{x.document_number} · {x.client_name} · {x.status}</option>)}</select></label>{selected?<section className="mt-4 border-t border-[#e5e8eb] pt-4"><h3 className="mb-1 text-[14px] font-semibold">{selected.document_number}</h3><p className="mb-4 text-[12px] text-[#68717d]">{selected.client_name} · {selected.balance_due} {selected.currency}</p><FinanceCompletionActions item={selected} busy={busy} run={run}/></section>:null}{error&&<p className="mt-3 rounded-[5px] bg-red-50 p-3 text-[12px] text-red-700">{error}</p>}</OperationDrawer>{settings?<FinanceSettingsModal close={()=>setSettings(false)}/>:null}</>}
