"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import { FormEvent, useEffect, useState } from "react";
import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { deactivateFinanceDuePolicy, listFinanceDuePolicies, getFinanceSettings, saveFinanceDuePolicy, type FinanceDuePolicy } from "@/services/finance";

const input = "h-9 w-full rounded-[5px] border border-[#d8dce0] px-3 text-[13px]";
const primary = "inline-flex h-9 items-center justify-center rounded-[5px] bg-[#16855f] px-3 text-[13px] font-semibold text-white disabled:opacity-50";
const secondary = "rounded-[5px] border border-[#d9dcdf] px-3 py-1.5 text-[12px] font-medium hover:bg-slate-50 disabled:opacity-50";
const eventLabels: Record<FinanceDuePolicy["trigger_event"], string> = {
  DEPARTURE: "Avant le départ", RECEPTION: "À la réception", ARRIVAL: "À l’arrivée",
  DELIVERY: "Avant la remise", MANUAL: "Déclenchement manuel",
};

export function FinanceDuePolicySettings({ embedded = false }: { embedded?: boolean }) {
  useDashboardMessages();
  const [policies, setPolicies] = useState<FinanceDuePolicy[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [ruleType, setRuleType] = useState<FinanceDuePolicy["rule_type"]>("PERCENTAGE");
  const [trigger, setTrigger] = useState<FinanceDuePolicy["trigger_event"]>("DEPARTURE");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeScopePolicy = policies.find(policy => policy.is_active && policy.trigger_event === trigger && !policy.shipping_service_id);

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

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!activeScopePolicy) { setName(""); setAmount(""); setRuleType("PERCENTAGE"); return; }
    setName(activeScopePolicy.name);
    setRuleType(activeScopePolicy.rule_type);
    setAmount(String(activeScopePolicy.rule_type === "PERCENTAGE" ? activeScopePolicy.percentage ?? "" : activeScopePolicy.fixed_amount ?? ""));
  }, [activeScopePolicy, trigger]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveFinanceDuePolicy({
        name: name.trim(), trigger_event: trigger, rule_type: ruleType,
        percentage: ruleType === "PERCENTAGE" ? Number(amount) : null,
        fixed_amount: ruleType === "FIXED_AMOUNT" ? Number(amount) : null,
        currency: currency.toUpperCase(), is_active: true,
      });
      await load();
    } catch (cause) {
      const detail = (cause as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail === "due_policy_name_exists_in_another_scope"
        ? "Ce nom est déjà utilisé pour une autre condition. Choisissez un nom différent."
        : detail === "due_policy_name_already_used"
        ? "Une ancienne condition utilise déjà ce nom. Choisissez un nom différent."
        : detail || "La condition n’a pas pu être enregistrée.");
    } finally { setBusy(false); }
  }

  async function deactivate(policy: FinanceDuePolicy) {
    if (!policy.id || !window.confirm(`Désactiver « ${policy.name} » ? Cette règle ne s’appliquera plus aux nouvelles opérations.`)) return;
    setBusy(true); setError("");
    try { await deactivateFinanceDuePolicy(policy.id); await load(); }
    catch { setError("La condition n’a pas pu être désactivée. Réessayez."); }
    finally { setBusy(false); }
  }

  return <div className="min-h-full bg-white">{!embedded && <OperationPageHeader backHref="/app/finance" title={dashboardText("Paramètres financiers")} description={dashboardText("Configurez les conditions financières de l’agence. Les modifications ne changent pas les factures déjà émises.")}/>}<OperationContent className={embedded ? "pt-0" : undefined}>
    <section className="max-w-[900px] space-y-3 rounded-[8px] border border-[#e4e7e9] p-5">
      <div><h3 className="text-[14px] font-semibold">{activeScopePolicy ? dashboardText("Modifier la condition active") : dashboardText("Ajouter une condition")}</h3><p className="mt-1 text-[12px] text-[#68717d]">{dashboardText("Une seule condition active est autorisée par étape et par service. Ici, la règle s’applique par défaut à l’agence; une règle de service configurée séparément reste prioritaire.")}</p></div>
      <form onSubmit={submit} className="space-y-3">
        <label className="grid gap-1.5 text-[12px] font-medium">{dashboardText("Nom de la règle")}<input required maxLength={120} className={input} value={name} onChange={event => setName(event.target.value)} placeholder={dashboardText("Ex. Acompte avant départ")} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] font-medium">{dashboardText("Déclenchement")}<select className={input} value={trigger} onChange={event => setTrigger(event.target.value as FinanceDuePolicy["trigger_event"])}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{dashboardText(label)}</option>)}</select></label>
          <label className="grid gap-1.5 text-[12px] font-medium">{dashboardText("Type de montant")}<select className={input} value={ruleType} onChange={event => setRuleType(event.target.value as FinanceDuePolicy["rule_type"])}><option value="PERCENTAGE">{dashboardText("Pourcentage du montant facturé")}</option><option value="FIXED_AMOUNT">{dashboardText("Montant fixe")}</option></select></label>
          <label className="grid gap-1.5 text-[12px] font-medium">{ruleType === "PERCENTAGE" ? dashboardText("Pourcentage exigible") : dashboardText("Montant exigible")}<input required value={amount} onChange={event => setAmount(event.target.value)} type="number" min={ruleType === "PERCENTAGE" ? 0 : "0.01"} max={ruleType === "PERCENTAGE" ? 100 : undefined} step="0.01" className={input} placeholder={ruleType === "PERCENTAGE" ? dashboardText("50") : "100.00"} /></label>
          <label className="grid gap-1.5 text-[12px] font-medium">{dashboardText("Devise")}<input required className={input} maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} /></label>
        </div>
        {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-[12px] text-red-700">{dashboardText(error)}</p>}
        <div className="flex justify-end"><button disabled={busy} className={primary}>{busy ? dashboardText("Enregistrement…") : activeScopePolicy ? dashboardText("Enregistrer les modifications") : dashboardText("Enregistrer la condition")}</button></div>
      </form>
    </section>
    <section className="mt-5 space-y-2"><h3 className="text-[14px] font-semibold">{dashboardText("Conditions configurées")}</h3>{policies.length ? policies.map(policy => <article key={policy.id || `${policy.trigger_event}-${policy.name}`} className="flex items-center justify-between gap-3 rounded-[6px] border border-[#e7ebef] p-3 text-[12px]"><div><b>{policy.name}</b><p className="mt-1 text-[#68717d]">{dashboardText(eventLabels[policy.trigger_event])}{policy.shipping_service_id ? dashboardText(" · Service spécifique") : dashboardText(" · Agence")} · {policy.rule_type === "PERCENTAGE" ? `${policy.percentage ?? 0} %` : `${policy.fixed_amount ?? 0} ${policy.currency}`}</p></div><div className="flex items-center gap-3"><span className={policy.is_active ? "text-emerald-700" : "text-slate-500"}>{policy.is_active ? dashboardText("Active") : dashboardText("Inactive")}</span>{policy.is_active && <button type="button" disabled={busy} className={secondary} onClick={() => void deactivate(policy)}>{dashboardText("Désactiver")}</button>}</div></article>) : <p className="text-[12px] text-[#68717d]">{dashboardText("Aucune règle configurée pour cette agence.")}</p>}</section>
  </OperationContent></div>;
}
