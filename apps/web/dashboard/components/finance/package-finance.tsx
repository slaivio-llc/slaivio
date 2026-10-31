"use client";
import {dashboardText,useDashboardMessages,dashboardFormatLocale} from '@/components/i18n/dashboard-messages';


import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { createPackageInvoice, getPackageInvoice, type FinanceDocument } from "@/services/finance";
import { pricePackage, type PackageRecord } from "@/services/packages";
import { PermissionGuard } from "@/components/permissions/permission-guard";

const messages: Record<string, string> = {
  package_pricing_required: "Calculez d’abord le tarif du colis depuis le moteur de tarification.",
  package_pricing_inconsistent: "Le tarif enregistré est incohérent. Faites-le vérifier avant facturation.",
  package_legacy_payments_require_reconciliation: "Ce colis possède des paiements historiques : rapprochez-les avant de créer une facture.",
  package_version_conflict: "Le colis a changé. Rouvrez sa fiche avant de créer la facture.",
  package_route_required_for_pricing: "Aucun trajet n’est associé à ce colis. Rattachez-le d’abord à un trajet configuré.",
  no_active_pricing_grid: "Aucune grille tarifaire active ne couvre ce service et ce trajet. Vérifiez Gestion > Tarification.",
  route_service_mismatch: "Le service sélectionné n’est pas proposé sur le trajet de ce colis.",
  pricing_input_required: "Une mesure requise par la grille tarifaire manque sur le colis (poids, volume ou valeur déclarée).",
  no_matching_pricing_rule: "Aucune règle tarifaire ne correspond au type de marchandise ou de colis. Vérifiez la configuration du service.",
  pricing_grid_has_no_price_rules: "La grille tarifaire de ce service ne contient pas encore de règle de prix.",
  manual_quote_required: "Ce colis dépasse les limites de la grille et nécessite un devis manuel avant facturation.",
  finance_office_scope_not_supported: "La finance nécessite actuellement une vue organisation complète et autorisée. Le filtrage financier par bureau reste à finaliser.",
};

function getErrorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string | { code?: string } } } })?.response?.data?.detail;
  const code = typeof detail === "string" ? detail : detail?.code;
  return (code && messages[code]) || "Situation financière indisponible. Vérifiez vos droits ou réessayez.";
}

export function PackageFinance({ item, onUpdated }: { item: PackageRecord; onUpdated: (item: PackageRecord) => void }) {
  useDashboardMessages();
  const [invoice, setInvoice] = useState<FinanceDocument | null>(null);
  const [pricedPackage, setPricedPackage] = useState(item);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const hasVerifiedPrice = Boolean(pricedPackage.pricing_snapshot && Object.keys(pricedPackage.pricing_snapshot).length > 0);

  useEffect(() => setPricedPackage(item), [item]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setInvoice(null);
    getPackageInvoice(item.id)
      .then(value => { if (active) setInvoice(value); })
      .catch(reason => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item.id, retry]);

  async function calculatePrice() {
    if (!pricedPackage.shipping_service_id || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await pricePackage(item.id, pricedPackage.shipping_service_id);
      setPricedPackage(updated);
      onUpdated(updated);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const version = pricedPackage.row_version;
    if (version == null || busy) return;
    setBusy(true);
    setError("");
    try {
      setInvoice(await createPackageInvoice(item.id, version));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const currency = invoice?.currency || pricedPackage.currency;
  const money = (amount: number | string | null | undefined) => {
    if (amount == null || !currency) return "—";
    return new Intl.NumberFormat(dashboardFormatLocale(), { style: "currency", currency }).format(Number(amount));
  };
  const total = invoice?.total ?? pricedPackage.fees_total;
  const paid = invoice?.amount_paid ?? pricedPackage.fees_paid;
  const balance = invoice?.balance_due ?? (total == null || paid == null ? null : Math.max(0, Number(total) - Number(paid)));
  const unavailable = loading || Boolean(error);
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{dashboardText("Paiement")}</h3>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
        {expanded ? dashboardText("Masquer les détails") : dashboardText("Détails du paiement")}<ChevronDown size={14} className={expanded ? "rotate-180 transition-transform" : "transition-transform"}/>
      </button>
    </div>
    <dl className="grid grid-cols-3 gap-3">
      <div><dt className="text-xs text-slate-500">{dashboardText("Total")}</dt><dd className="mt-1 text-sm font-semibold">{unavailable ? "—" : total == null ? dashboardText("Tarif à calculer") : money(total)}</dd></div>
      <div><dt className="text-xs text-slate-500">{dashboardText("Payé")}</dt><dd className="mt-1 text-sm font-semibold text-emerald-700">{money(unavailable ? null : paid)}</dd></div>
      <div><dt className="text-xs text-slate-500">{dashboardText("Reste")}</dt><dd className="mt-1 text-sm font-semibold text-red-700">{money(unavailable ? null : balance)}</dd></div>
    </dl>
    {!expanded && loading && <p role="status" className="text-xs text-slate-500">{dashboardText("Actualisation de la facture…")}</p>}
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-800">{dashboardText(error)}</p><button type="button" className="mt-2 text-sm underline" onClick={() => setRetry(value => value + 1)}>{dashboardText("Réessayer")}</button></div>}
    {expanded && <div className="space-y-4 border-t border-slate-100 pt-4">
    <h4 className="text-sm font-semibold">{dashboardText("Détails Finance")}</h4>
    {loading ? <p role="status" className="text-sm text-slate-500">{dashboardText("Chargement de la situation financière…")}</p> : invoice ? <>
      <p className="text-sm">{invoice.document_number} {invoice.status === "DRAFT" ? dashboardText("· Brouillon — aucun paiement demandé") : dashboardText("· Facture")}</p>
      <dl className="grid gap-3 sm:grid-cols-3">{[
        [dashboardText("Montant de la facture"), invoice.total], [dashboardText("Paiements reçus"), invoice.amount_paid],
        [invoice.status === "DRAFT" ? dashboardText("Solde du brouillon") : dashboardText("Solde de la facture"), invoice.balance_due],
      ].map(([label, amount]) => <div key={label}><dt className="text-xs text-slate-500">{dashboardText(label)}</dt><dd className="mt-1 font-semibold">{new Intl.NumberFormat(dashboardFormatLocale(), { style: "currency", currency: invoice.currency }).format(Number(amount))}</dd></div>)}</dl>
      <Link className="inline-flex h-9 items-center rounded-md border px-3 text-sm" href={`/app/finance?open=${encodeURIComponent(invoice.id)}`}>{dashboardText("Ouvrir dans Finance")}</Link>
    </> : <>
      <p className="text-sm text-slate-500">{dashboardText("Aucune facture liée. Une facture reprend un tarif calculé et enregistré ; elle ne constitue pas une preuve d’encaissement.")}</p>
      {!hasVerifiedPrice ? pricedPackage.shipping_service_id ? <PermissionGuard permission="packages.pricing">
        <button disabled={busy || pricedPackage.row_version == null} onClick={calculatePrice} className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">
          {busy ? dashboardText("Calcul du tarif…") : dashboardText("Calculer le tarif du colis")}
        </button>
      </PermissionGuard> : <p className="text-sm text-amber-800">{dashboardText("Aucun service configuré sur ce colis. Associez d’abord un trajet et un service dans sa fiche, puis calculez le tarif.")}</p> : <PermissionGuard permission="finance.create">
        <button disabled={busy || pricedPackage.row_version == null} onClick={create} className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">
          {busy ? dashboardText("Création…") : dashboardText("Créer la facture depuis le tarif enregistré")}
        </button>
      </PermissionGuard>}
    </>}
    </div>}
  </section>;
}
