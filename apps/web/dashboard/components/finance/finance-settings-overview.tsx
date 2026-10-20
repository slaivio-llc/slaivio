"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { FinancePaymentConditions } from "./finance-payment-conditions";
import { OperationContent } from "@/components/ui/operation-primitives";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { getFinanceSettings, listFinanceDuePolicies, saveFinanceSettings, type FinanceDuePolicy, type FinanceSettings } from "@/services/finance";

const button = "inline-flex h-8 items-center justify-center rounded-full border border-[#d9dcdf] bg-white px-3 text-[12px] font-medium text-[#454e55] hover:bg-[#f5f6f6]";
const methodLabels: Record<string, string> = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", BANK_TRANSFER: "Virement", CARD: "Carte" };

export function FinanceSettingsOverview() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [policies, setPolicies] = useState<FinanceDuePolicy[]>([]);
  const [panel, setPanel] = useState<"currency" | "methods" | "conditions" | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [financeSettings, duePolicies] = await Promise.all([getFinanceSettings(), listFinanceDuePolicies()]);
      setSettings(financeSettings);
      setCurrency(financeSettings.default_currency || "USD");
      setPolicies(duePolicies);
      setError("");
    } catch {
      setError("Les paramètres financiers n’ont pas pu être chargés. Réessayez.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      const updated = await saveFinanceSettings({ ...settings, default_currency: currency.trim().toUpperCase() });
      setSettings(updated);
      setCurrency(updated.default_currency);
      setPanel(null);
    } catch {
      setError("La devise de référence n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  const activePolicies = policies.filter(policy => policy.is_active);
  const termsSummary = activePolicies.length
    ? activePolicies.map(policy => policy.name).join(", ")
    : "Aucune condition configurée";

  return <OperationContent className="pt-3">
    <h2 className="text-[13px] font-semibold text-[#303941]">Paramètres financiers</h2>
    {error && <p role="alert" className="mt-3 rounded-[7px] bg-[#fff5f4] p-3 text-[12px] text-[#9d352d]">{error}</p>}
    <section className="mt-2 rounded-[8px] border border-[#e0e3e5] px-3 sm:px-4">
      <div className="flex min-h-[62px] items-center justify-between gap-3 border-b border-[#e8eaec] py-3">
        <div><h3 className="text-[12px] font-medium text-[#303941]">Devise de référence</h3><p className="mt-1 text-[10px] text-[#78828a]">Utilisée dans les rapports financiers</p></div>
        <div className="flex items-center gap-3"><span className="rounded-full bg-[#f0f1f2] px-2 py-1 text-[10px] font-medium text-[#505a62]">{settings?.default_currency || "…"}</span><button type="button" className={button} onClick={() => setPanel("currency")}>Configurer</button></div>
      </div>
      <div className="flex min-h-[62px] items-center justify-between gap-3 border-b border-[#e8eaec] py-3">
        <div><h3 className="text-[12px] font-medium text-[#303941]">Méthodes de paiement</h3><p className="mt-1 text-[10px] text-[#78828a]">Espèces, Mobile Money, virement</p></div>
        <button type="button" className={button} onClick={() => setPanel("methods")}>Configurer</button>
      </div>
      <div className="flex min-h-[62px] items-center justify-between gap-3 py-3">
        <div className="min-w-0"><h3 className="text-[12px] font-medium text-[#303941]">Conditions de règlement</h3><p className="mt-1 truncate text-[10px] text-[#78828a]">{termsSummary}</p></div>
        <button type="button" className={button} onClick={() => setPanel("conditions")}>Configurer</button>
      </div>
    </section>

    <OperationDrawer open={panel === "currency"} close={() => setPanel(null)} title="Devise de référence" description="Cette devise est utilisée par défaut pour les rapports financiers." width="max-w-[480px]">
      <form onSubmit={saveCurrency} className="space-y-4 p-5">
        <label className="grid gap-1.5 text-[12px] font-medium text-[#303941]">Devise<select required className="h-10 rounded-[6px] border border-[#d8dce0] bg-white px-3 text-[13px]" value={currency} onChange={event => setCurrency(event.target.value)}>{["USD","EUR","CDF","AOA","CNY","XOF","XAF","GBP","AED","GHS","KES"].map(code => <option key={code} value={code}>{code}</option>)}</select></label>
        <div className="flex justify-end"><button disabled={busy || !settings} className="inline-flex h-9 items-center rounded-[6px] bg-[#111] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "Enregistrement…" : "Enregistrer"}</button></div>
      </form>
    </OperationDrawer>
    <OperationDrawer open={panel === "methods"} close={() => setPanel(null)} title="Méthodes de paiement" description="Les paiements sont enregistrés manuellement par l’agence. Aucun débit automatique n’est effectué." width="max-w-[480px]">
      <div className="space-y-1 p-4">{Object.entries(methodLabels).map(([code, label]) => <div key={code} className="flex items-center justify-between rounded-[6px] px-3 py-3 text-[13px] text-[#303941]"><span>{label}</span><Check size={16} className="text-[#16855f]" aria-label="Disponible"/></div>)}<p className="px-3 pt-2 text-[11px] leading-5 text-[#78828a]">Ces moyens sont saisis lors de l’enregistrement du paiement. Leur activation individuelle n’est pas encore configurable.</p></div>
    </OperationDrawer>
    <OperationDrawer open={panel === "conditions"} close={() => { setPanel(null); void load(); }} title="Conditions de règlement" description="Configurez les échéances et les montants exigibles selon les étapes opérationnelles." width="max-w-[760px]">
      <FinancePaymentConditions />
    </OperationDrawer>
  </OperationContent>;
}
