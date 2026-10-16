"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { payFinance, type FinanceDocument } from "@/services/finance";

const storageKey = (documentId: string) => `finance:manual-payment:${documentId}`;

function readStoredAttempt(documentId: string) {
  if (typeof window === "undefined") return null;
  const item = window.sessionStorage.getItem(storageKey(documentId));
  if (!item) return null;
  try {
    const parsed = JSON.parse(item) as { amount: string; idempotency_key: string; submitted: boolean; confirmed: boolean };
    if (!parsed?.idempotency_key || !parsed.amount) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function RecordPaymentForm({ document, onRecorded, onCancel }: {
  document: FinanceDocument;
  onRecorded: () => Promise<void>;
  onCancel: () => void;
}) {
  const restore = readStoredAttempt(document.id);
  const [amount, setAmount] = useState(() => restore?.amount ?? String(document.balance_due));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(restore?.submitted));
  const [confirmed, setConfirmed] = useState(Boolean(restore?.confirmed));
  const pending = useRef(false);
  const attempt = useRef<Parameters<typeof payFinance>[1] | null>(restore ? {
    amount: Number(restore.amount),
    currency: document.currency,
    method: "MANUAL",
    paid_at: new Date().toISOString(),
    idempotency_key: restore.idempotency_key,
  } : null);

  useEffect(() => {
    const restored = readStoredAttempt(document.id);
    if (!restored) {
      setAmount(String(document.balance_due));
      setSubmitted(false);
      setConfirmed(false);
      attempt.current = null;
      return;
    }
    setAmount(restored.amount);
    setSubmitted(Boolean(restored.submitted));
    setConfirmed(Boolean(restored.confirmed));
    attempt.current = {
      amount: Number(restored.amount),
      currency: document.currency,
      method: "MANUAL",
      paid_at: new Date().toISOString(),
      idempotency_key: restored.idempotency_key,
    };
  }, [document.id, document.balance_due, document.currency]);

  function persist(nextAmount: string, nextSubmitted: boolean, nextConfirmed: boolean) {
    const payload = attempt.current ? {
      amount: nextAmount,
      idempotency_key: attempt.current.idempotency_key,
      submitted: nextSubmitted,
      confirmed: nextConfirmed,
    } : null;
    if (!payload) {
      sessionStorage.removeItem(storageKey(document.id));
      return;
    }
    sessionStorage.setItem(storageKey(document.id), JSON.stringify(payload));
  }

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
    let paymentRecorded = false;
    try {
      if (!confirmed) {
        attempt.current ??= { amount: Number(normalized), currency: document.currency,
          method: "MANUAL", paid_at: new Date().toISOString(), idempotency_key: crypto.randomUUID() };
        persist(String(normalized), true, false);
        setSubmitted(true);
        await payFinance(document.id, attempt.current);
        setConfirmed(true);
        paymentRecorded = true;
        persist(String(normalized), true, true);
      }
      await onRecorded();
      if (paymentRecorded) {
        sessionStorage.removeItem(storageKey(document.id));
      }
    } catch {
      if (paymentRecorded) {
        persist(String(normalized), true, true);
        setConfirmed(true);
      } else {
        persist(String(normalized), true, false);
      }
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
        onChange={event => { setAmount(event.target.value); if (attempt.current) persist(event.target.value, submitted, confirmed); }} className="h-9 rounded-md border border-slate-300 px-3 focus:border-emerald-600 focus:outline-none" />
    </label>
    <p className="text-xs text-slate-500">La même demande de paiement est reprise avec la même clé d’idempotence pour éviter un double encaissement.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex gap-2">
      <button disabled={busy} type="submit" className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Enregistrement…" : confirmed ? "Actualiser le paiement confirmé" : submitted ? "Vérifier la même demande" : "Enregistrer"}
      </button>
      {!submitted && <button type="button" onClick={() => { sessionStorage.removeItem(storageKey(document.id)); onCancel(); }} className="h-9 rounded-md border px-3 text-sm">Annuler</button>}
    </div>
  </form>;
}
