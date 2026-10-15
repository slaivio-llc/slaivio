"use client";

import { FormEvent, useRef, useState } from "react";
import { payFinance, type FinanceDocument } from "@/services/finance";

export function RecordPaymentForm({ document, onRecorded, onCancel }: {
  document: FinanceDocument;
  onRecorded: () => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(document.balance_due));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<Parameters<typeof payFinance>[1] | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const normalized = amount.trim().replace(",", ".");
    if (!attempt.current && (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0 || Number(normalized) > Number(document.balance_due))) {
      setError("Saisissez un montant positif, au maximum égal au solde, avec deux décimales au plus.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (!confirmed) {
        attempt.current ??= { amount: Number(normalized), currency: document.currency,
          method: "MANUAL", paid_at: new Date().toISOString(), idempotency_key: crypto.randomUUID() };
        setSubmitted(true);
        await payFinance(document.id, attempt.current);
        setConfirmed(true);
      }
      await onRecorded();
    } catch {
      setError("La confirmation n’a pas pu être affichée. Réessayez ici : la même demande sera reprise, sans nouvel encaissement. Ne créez pas un autre paiement avant vérification de l’historique.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-lg border border-[#e5e8eb] p-4" aria-label="Enregistrer un paiement">
    <div><h3 className="text-sm font-semibold">Enregistrer un paiement reçu</h3>
      <p className="mt-1 text-xs text-slate-500">{document.client_name} · {document.document_number}</p></div>
    <label className="grid max-w-xs gap-1.5 text-sm">Montant reçu ({document.currency})
      <input autoFocus required inputMode="decimal" value={amount} disabled={busy || submitted}
        onChange={event => setAmount(event.target.value)} className="h-9 rounded-md border border-slate-300 px-3 focus:border-emerald-600 focus:outline-none" />
    </label>
    <p className="text-xs text-slate-500">Enregistrez uniquement l’argent réellement reçu par l’agence.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex gap-2">
      <button disabled={busy} type="submit" className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Enregistrement…" : confirmed ? "Actualiser le paiement confirmé" : submitted ? "Vérifier la même demande" : "Enregistrer"}
      </button>
      {!submitted && <button type="button" onClick={onCancel} className="h-9 rounded-md border px-3 text-sm">Annuler</button>}
    </div>
  </form>;
}
