"use client";

import { FormEvent, useEffect, useState } from "react";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { listFinanceDuePolicies, getFinanceSettings, saveFinanceDuePolicy, type FinanceDuePolicy } from "@/services/finance";

const input = "h-9 w-full rounded-[5px] border border-[#d8dce0] px-3 text-[13px]";
const primary = "inline-flex h-9 items-center justify-center rounded-[5px] bg-[#16855f] px-3 text-[13px] font-semibold text-white disabled:opacity-50";
const eventLabels: Record<FinanceDuePolicy["trigger_event"], string> = {
  DEPARTURE: "Avant le départ",
  RECEPTION: "À la réception",
  ARRIVAL: "À l’arrivée",
  DELIVERY: "Avant la remise",
  MANUAL: "Déclenchement manuel",
};

export function FinanceDuePolicySettings({ open, close }: { open: boolean; close: () => void }) {
  const [policies, setPolicies] = useState<FinanceDuePolicy[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [ruleType, setRuleType] = useState<FinanceDuePolicy["rule_type"]>("PERCENTAGE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [settings, rules] = await Promise.all([getFinanceSettings(), listFinanceDuePolicies()]);
      setCurrency(settings.default_currency || "USD");
      setPolicies(rules);
      setError("");
    } catch {
      setError("Les conditions financières n’ont pas pu être chargées. Réessayez.");
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    const form = new FormData(formElement);
    const type = String(form.get("rule_type")) as FinanceDuePolicy["rule_type"];
    const amount = Number(form.get(type === "PERCENTAGE" ? "percentage" : "fixed_amount"));
    try {
      await saveFinanceDuePolicy({
        name: String(form.get("name") || "").trim(),
        trigger_event: String(form.get("trigger_event")) as FinanceDuePolicy["trigger_event"],
        rule_type: type,
        percentage: type === "PERCENTAGE" ? amount : null,
        fixed_amount: type === "FIXED_AMOUNT" ? amount : null,
        currency: String(form.get("currency") || currency).toUpperCase(),
        is_active: true,
      });
      await load();
      formElement.reset();
      setRuleType("PERCENTAGE");
    } catch (cause) {
      setError((cause as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "La règle n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  return <OperationDrawer open={open} close={close} title="Conditions de paiement" description="Définissez ce qui devient exigible à chaque étape. Ces règles ne modifient pas les factures déjà émises." width="max-w-[680px]">
    <section className="space-y-3 rounded-[8px] border border-[#e4e7e9] p-4">
      <div><h3 className="text-[14px] font-semibold">Ajouter une condition</h3><p className="mt-1 text-[12px] text-[#68717d]">Une règle active s’applique à tous les services tant qu’aucune règle propre au service n’est définie.</p></div>
      <form onSubmit={submit} className="space-y-3">
        <label className="grid gap-1.5 text-[12px] font-medium">Nom de la règle<input required name="name" className={input} placeholder="Ex. Acompte avant départ" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] font-medium">Déclenchement<select name="trigger_event" className={input} defaultValue="DEPARTURE">{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1.5 text-[12px] font-medium">Type de montant<select name="rule_type" className={input} value={ruleType} onChange={e => setRuleType(e.target.value as FinanceDuePolicy["rule_type"])}><option value="PERCENTAGE">Pourcentage du montant facturé</option><option value="FIXED_AMOUNT">Montant fixe</option></select></label>
          <label className="grid gap-1.5 text-[12px] font-medium">{ruleType === "PERCENTAGE" ? "Pourcentage exigible" : "Montant exigible"}<input required name={ruleType === "PERCENTAGE" ? "percentage" : "fixed_amount"} type="number" min={ruleType === "PERCENTAGE" ? 0 : "0.01"} max={ruleType === "PERCENTAGE" ? 100 : undefined} step="0.01" className={input} placeholder={ruleType === "PERCENTAGE" ? "50" : "100.00"} /></label>
          <label className="grid gap-1.5 text-[12px] font-medium">Devise<input required name="currency" className={input} maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label>
        </div>
        {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-[12px] text-red-700">{error}</p>}
        <div className="flex justify-end"><button disabled={busy} className={primary}>{busy ? "Enregistrement…" : "Enregistrer la condition"}</button></div>
      </form>
    </section>
    <section className="mt-5 space-y-2"><h3 className="text-[14px] font-semibold">Conditions configurées</h3>{policies.length ? policies.map(policy => <article key={policy.id || `${policy.trigger_event}-${policy.name}`} className="flex items-center justify-between gap-3 rounded-[6px] border border-[#e7ebef] p-3 text-[12px]"><div><b>{policy.name}</b><p className="mt-1 text-[#68717d]">{eventLabels[policy.trigger_event]} · {policy.rule_type === "PERCENTAGE" ? `${policy.percentage ?? 0} %` : `${policy.fixed_amount ?? 0} ${policy.currency}`}</p></div><span className={policy.is_active ? "text-emerald-700" : "text-slate-500"}>{policy.is_active ? "Active" : "Inactive"}</span></article>) : <p className="text-[12px] text-[#68717d]">Aucune règle configurée pour cette agence.</p>}</section>
  </OperationDrawer>;
}
