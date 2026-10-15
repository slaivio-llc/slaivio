"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPackageInvoice, getPackageInvoice, type FinanceDocument } from "@/services/finance";
import { PermissionGuard } from "@/components/permissions/permission-guard";

const messages: Record<string,string> = {
  package_pricing_required: "Calculez d’abord le tarif du colis depuis le moteur de tarification.",
  package_pricing_inconsistent: "Le tarif enregistré est incohérent. Faites-le vérifier avant facturation.",
  package_legacy_payments_require_reconciliation: "Ce colis possède des paiements historiques : rapprochez-les avant de créer une facture.",
  package_version_conflict: "Le colis a changé. Rouvrez sa fiche avant de créer la facture.",
  finance_office_scope_not_supported: "La finance nécessite actuellement une vue organisation complète et autorisée. Le filtrage financier par bureau reste à finaliser.",
};
function message(error: unknown) {
  const code = (error as {response?:{data?:{detail?:string}}})?.response?.data?.detail;
  return (code && messages[code]) || "Situation financière indisponible. Vérifiez vos droits ou réessayez.";
}

export function PackageFinance({ packageId, version }: { packageId: string; version?: number }) {
  const [invoice, setInvoice] = useState<FinanceDocument|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setInvoice(null);
    getPackageInvoice(packageId).then(value => { if (active) setInvoice(value); })
      .catch(e => { if (active) setError(message(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [packageId, retry]);
  async function create() {
    if (!version || busy) return;
    setBusy(true); setError("");
    try { setInvoice(await createPackageInvoice(packageId, version)); }
    catch(e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status" className="text-sm text-slate-500">Chargement de la situation financière…</p>;
  return <section className="space-y-4">
    <h3 className="font-semibold">Finance du colis</h3>
    {error ? <div role="alert"><p className="text-sm text-red-700">{error}</p><button className="mt-2 text-sm underline" onClick={() => setRetry(x => x+1)}>Réessayer</button></div> : invoice ? <>
      <p className="text-sm">{invoice.document_number} {invoice.status === "DRAFT" ? "· Brouillon — aucun paiement demandé" : "· Facture"}</p>
      <dl className="grid gap-3 sm:grid-cols-3">{[
        ["Montant de la facture", invoice.total], ["Paiements reçus", invoice.amount_paid],
        [invoice.status === "DRAFT" ? "Solde du brouillon" : "Solde de la facture", invoice.balance_due],
      ].map(([label, amount]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{new Intl.NumberFormat("fr-FR", {style:"currency", currency:invoice.currency}).format(Number(amount))}</dd></div>)}</dl>
      <Link className="inline-flex h-9 items-center rounded-md border px-3 text-sm" href={`/app/finance?open=${encodeURIComponent(invoice.id)}`}>Ouvrir dans Finance</Link>
    </> : <>
      <p className="text-sm text-slate-500">Aucune facture liée. Le tarif du colis n’est pas une preuve d’encaissement.</p>
      <PermissionGuard permission="finance.create"><button disabled={busy || !version} onClick={create} className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">{busy ? "Création…" : "Préparer la facture depuis le tarif"}</button></PermissionGuard>
    </>}
  </section>;
}
