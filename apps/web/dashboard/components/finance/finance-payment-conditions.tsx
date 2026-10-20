"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info } from "lucide-react";
import { getFinanceSettings, listFinanceDuePolicies, saveFinanceDuePolicy, deactivateFinanceDuePolicy, saveFinanceSettings, type FinanceDuePolicy, type FinanceSettings } from "@/services/finance";
import { listServices, type Service } from "@/services/service-catalog";

type Moment = "FULL_DEPARTURE" | "DEPOSIT_DEPARTURE" | "ARRIVAL" | "DELIVERY" | "CREDIT";
const input = "h-10 w-full rounded-[6px] border border-[#d8dce0] bg-white px-3 text-[13px] outline-none focus:border-[#16855f]";
const action = "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#111] px-4 text-[12px] font-semibold text-white disabled:opacity-50";
const momentOptions: Array<{ value: Moment; label: string; hint: string }> = [
  { value: "FULL_DEPARTURE", label: "Paiement intégral avant départ", hint: "100 % exigé avant expédition" },
  { value: "DEPOSIT_DEPARTURE", label: "Acompte avant départ", hint: "Un pourcentage exigé avant expédition" },
  { value: "ARRIVAL", label: "Paiement à l’arrivée", hint: "À l’arrivée confirmée de la marchandise" },
  { value: "DELIVERY", label: "Paiement avant livraison", hint: "Avant la remise du colis au client" },
  { value: "CREDIT", label: "Paiement différé / à crédit", hint: "Délai accordé après facturation" },
];
const events = ["DEPARTURE", "ARRIVAL", "DELIVERY"] as const;

function inferMoment(policies: FinanceDuePolicy[], serviceId: string): Moment {
  const scoped = policies.filter(policy => policy.is_active && (policy.shipping_service_id || "") === serviceId);
  const active = serviceId && !scoped.length
    ? policies.filter(policy => policy.is_active && !policy.shipping_service_id)
    : scoped;
  const departure = active.find(policy => policy.trigger_event === "DEPARTURE");
  if (departure) return Number(departure.percentage) >= 100 ? "FULL_DEPARTURE" : "DEPOSIT_DEPARTURE";
  const arrival = active.find(policy => policy.trigger_event === "ARRIVAL");
  if (arrival) return Number(arrival.percentage) === 0 ? "CREDIT" : "ARRIVAL";
  if (active.some(policy => policy.trigger_event === "DELIVERY")) return "DELIVERY";
  return "CREDIT";
}

export function FinancePaymentConditions() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [policies, setPolicies] = useState<FinanceDuePolicy[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [scope, setScope] = useState("");
  const [moment, setMoment] = useState<Moment>("FULL_DEPARTURE");
  const [deposit, setDeposit] = useState("50");
  const [blockDeparture, setBlockDeparture] = useState(true);
  const [blockDelivery, setBlockDelivery] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [financeSettings, duePolicies] = await Promise.all([getFinanceSettings(), listFinanceDuePolicies()]);
      setSettings(financeSettings);
      setPolicies(duePolicies);
      try { setServices((await listServices({ status: "ACTIVE" })).items); } catch { setServices([]); }
      setBlockDeparture(financeSettings.block_departure_confirmation ?? true);
      setBlockDelivery(financeSettings.block_delivery_release ?? false);
      setReminders(financeSettings.payment_reminders_enabled ?? true);
      setError("");
    } catch {
      setError("Les conditions de règlement n’ont pas pu être chargées. Réessayez.");
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { setMoment(inferMoment(policies, scope)); }, [policies, scope]);

  const summary = useMemo(() => {
    const label = momentOptions.find(option => option.value === moment)?.label || "";
    if (moment === "FULL_DEPARTURE") return "Le client doit régler la totalité du montant exigible avant la confirmation du départ.";
    if (moment === "DEPOSIT_DEPARTURE") return `Le client doit régler ${deposit || 0} % du montant exigible avant la confirmation du départ.`;
    if (moment === "ARRIVAL") return "Le montant exigible est réglé à l’arrivée confirmée de la marchandise.";
    if (moment === "DELIVERY") return "Le montant exigible est réglé avant la remise du colis au client.";
    return `Le paiement est différé selon les conditions de l’agence. ${label}.`;
  }, [moment, deposit]);

  async function save() {
    if (!settings) return;
    setBusy(true); setError("");
    try {
      const activeForScope = policies.filter(policy => policy.is_active && (policy.shipping_service_id || "") === scope && events.includes(policy.trigger_event as typeof events[number]));
      for (const policy of activeForScope) if (policy.id) await deactivateFinanceDuePolicy(policy.id);
      const target = moment === "FULL_DEPARTURE" || moment === "DEPOSIT_DEPARTURE" ? "DEPARTURE" : moment === "ARRIVAL" || moment === "CREDIT" ? "ARRIVAL" : moment === "DELIVERY" ? "DELIVERY" : null;
      if (target) {
        const percent = moment === "DEPOSIT_DEPARTURE" ? Number(deposit) : moment === "CREDIT" ? 0 : 100;
        const priorName = activeForScope.find(policy => policy.trigger_event === target)?.name;
        const scopeLabel = services.find(service => service.id === scope)?.service_name || "Agence";
        await saveFinanceDuePolicy({
          name: priorName || `${momentOptions.find(option => option.value === moment)!.label} — ${scopeLabel}`,
          shipping_service_id: scope || null,
          trigger_event: target,
          rule_type: "PERCENTAGE",
          percentage: percent,
          currency: settings.default_currency || "USD",
          is_active: true,
        });
      }
      const updated = await saveFinanceSettings({
        ...settings,
        block_departure_confirmation: blockDeparture,
        block_delivery_release: blockDelivery,
        payment_reminders_enabled: reminders,
      });
      setSettings(updated);
      await load();
    } catch (cause) {
      const detail = (cause as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Les conditions de règlement n’ont pas pu être enregistrées. Réessayez.");
    } finally { setBusy(false); }
  }

  const Toggle = ({ checked, onChange, title, hint }: { checked: boolean; onChange: (value: boolean) => void; title: string; hint: string }) => <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-2 text-left"><span><strong className="block text-[12px] font-medium text-[#303941]">{title}</strong><span className="mt-0.5 block text-[10px] text-[#78828a]">{hint}</span></span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${checked ? "bg-[#202326] text-white" : "border border-[#cbd0d4] bg-white"}`}>{checked && <Check size={12}/>}</span></button>;

  return <div className="max-w-[900px] space-y-4">
    <section className="rounded-[8px] border border-[#e1e4e6] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between"><div><h3 className="text-[14px] font-semibold">Conditions de règlement</h3><p className="mt-1 text-[11px] text-[#78828a]">Définissez quand et combien le client doit régler.</p></div><span className="rounded-full bg-[#f0f1f2] px-2.5 py-1 text-[10px]">Configuration agence</span></div>
      <div className="space-y-4">
        <label className="grid gap-1.5 text-[12px] font-medium">Appliquer cette politique à<select className={input} value={scope} onChange={event => setScope(event.target.value)}><option value="">Tous les services — règle par défaut</option>{services.map(service => <option key={service.id} value={service.id}>{service.service_name}</option>)}</select><span className="text-[10px] font-normal text-[#78828a]">Une règle spécifique à un service remplace la règle générale.</span></label>
        <fieldset className="space-y-1"><legend className="mb-1 text-[12px] font-semibold">Moment du règlement</legend>{momentOptions.map(option => <button key={option.value} type="button" onClick={() => setMoment(option.value)} className="flex w-full items-center gap-3 rounded-[6px] px-1 py-1.5 text-left"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${moment===option.value?"border-[#111] bg-[#111]":"border-[#cbd0d4]"}`}>{moment===option.value&&<span className="h-1.5 w-1.5 rounded-full bg-white"/>}</span><span><strong className="text-[12px] font-medium text-[#303941]">{option.label}</strong><span className="ml-2 text-[10px] text-[#78828a]">{option.hint}</span></span></button>)}</fieldset>
        {moment === "DEPOSIT_DEPARTURE" && <label className="grid gap-1.5 text-[12px] font-medium">Pourcentage exigé avant départ<input type="number" min="0.01" max="100" step="0.01" className={input} value={deposit} onChange={event => setDeposit(event.target.value)}/></label>}
        <div className="space-y-1"><h4 className="text-[12px] font-semibold">Contrôles des opérations</h4><Toggle checked={blockDeparture} onChange={setBlockDeparture} title="Bloquer la confirmation du départ" hint="Uniquement si le montant exigible avant départ n’est pas réglé."/><Toggle checked={blockDelivery} onChange={setBlockDelivery} title="Bloquer la remise du colis" hint="Uniquement si un montant exigible avant livraison reste impayé."/><Toggle checked={reminders} onChange={setReminders} title="Activer les rappels de paiement" hint="Rendre les dossiers éligibles aux relances selon leur échéance."/></div>
        <div className="rounded-[7px] border border-[#e1e4e6] bg-[#fafbfb] p-3"><p className="flex items-center gap-2 text-[11px] font-semibold"><Info size={13}/>Résumé de la politique</p><p className="mt-2 text-[11px] text-[#303941]">{summary}</p><p className="mt-1 text-[10px] text-[#78828a]">Départ : contrôle {blockDeparture?"actif":"inactif"} · Livraison : {blockDelivery?"blocage activé":"pas de blocage automatique"}.</p></div>
        {error&&<p role="alert" className="rounded bg-red-50 p-2 text-[12px] text-red-700">{error}</p>}
        <div className="flex justify-end"><button type="button" onClick={() => {setScope("");setMoment("FULL_DEPARTURE");setDeposit("50");setBlockDeparture(true);setBlockDelivery(false);setReminders(true);}} className="mr-2 h-9 rounded-full border border-[#d9dcdf] px-3 text-[12px]">Réinitialiser</button><button type="button" disabled={!settings||busy} onClick={() => void save()} className={action}>{busy?"Enregistrement…":<><Check size={14}/>Enregistrer</>}</button></div>
      </div>
    </section>
  </div>;
}
