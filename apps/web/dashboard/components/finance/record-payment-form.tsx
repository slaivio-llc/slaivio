"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Banknote, CalendarDays, Landmark, Smartphone } from "lucide-react";
import { payFinance, type FinanceDocument } from "@/services/finance";

const storageKey = (documentId: string) => `finance:manual-payment:${documentId}`;
type StoredAttempt = { amount: string; idempotency_key: string; submitted: boolean; confirmed: boolean; method: string; paid_at: string; reference: string; internal_note: string };
function localDate() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function readStoredAttempt(documentId: string): StoredAttempt | null {
  if (typeof window === "undefined") return null;
  const item = window.sessionStorage.getItem(storageKey(documentId));
  if (!item) return null;
  try {
    const parsed = JSON.parse(item) as StoredAttempt;
    return parsed?.idempotency_key && parsed.amount ? { ...parsed, method: parsed.method || "MANUAL", paid_at: parsed.paid_at || new Date().toISOString(), reference: parsed.reference || "", internal_note: parsed.internal_note || "" } : null;
  } catch { return null; }
}
const cash = (value: number, currency: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(value || 0));

export function RecordPaymentForm({ document, onRecorded, onCancel }: { document: FinanceDocument; onRecorded: () => Promise<void>; onCancel: () => void }) {
  const restore = readStoredAttempt(document.id);
  const [amount, setAmount] = useState(() => restore?.amount ?? String(document.balance_due));
  const [method, setMethod] = useState(() => restore?.method ?? "CASH");
  const [paidDate, setPaidDate] = useState(() => restore?.paid_at?.slice(0, 10) ?? localDate());
  const [reference, setReference] = useState(() => restore?.reference ?? "");
  const [internalNote, setInternalNote] = useState(() => restore?.internal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(restore?.submitted));
  const [confirmed, setConfirmed] = useState(Boolean(restore?.confirmed));
  const pending = useRef(false);
  const attempt = useRef<Parameters<typeof payFinance>[1] | null>(restore ? {
    amount: Number(restore.amount), currency: document.currency, method: restore.method,
    paid_at: restore.paid_at, reference: restore.reference || null, internal_note: restore.internal_note || null, idempotency_key: restore.idempotency_key,
  } : null);

  useEffect(() => {
    const restored = readStoredAttempt(document.id);
    if (!restored) {
      setAmount(String(document.balance_due)); setMethod("CASH"); setPaidDate(localDate()); setReference(""); setInternalNote("");
      setSubmitted(false); setConfirmed(false); attempt.current = null;
      return;
    }
    setAmount(restored.amount); setMethod(restored.method); setPaidDate(restored.paid_at.slice(0, 10)); setReference(restored.reference); setInternalNote(restored.internal_note);
    setSubmitted(Boolean(restored.submitted)); setConfirmed(Boolean(restored.confirmed));
    attempt.current = { amount: Number(restored.amount), currency: document.currency, method: restored.method, paid_at: restored.paid_at, reference: restored.reference || null, internal_note: restored.internal_note || null, idempotency_key: restored.idempotency_key };
  }, [document.id, document.balance_due, document.currency]);

  function persist(nextAmount: string, nextSubmitted: boolean, nextConfirmed: boolean) {
    if (!attempt.current) return;
    sessionStorage.setItem(storageKey(document.id), JSON.stringify({
      amount: nextAmount, idempotency_key: attempt.current.idempotency_key, submitted: nextSubmitted, confirmed: nextConfirmed,
      method: attempt.current.method, paid_at: attempt.current.paid_at, reference: attempt.current.reference || "", internal_note: attempt.current.internal_note || "",
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const normalized = amount.trim().replace(",", ".");
    if (!attempt.current && (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0 || Number(normalized) > Number(document.balance_due))) {
      setError("Saisissez un montant positif, au maximum égal au solde, avec deux décimales au plus."); return;
    }
    pending.current = true; setBusy(true); setError("");
    let paymentRecorded = false;
    try {
      if (!confirmed) {
        attempt.current ??= {
          amount: Number(normalized), currency: document.currency, method,
          paid_at: new Date(`${paidDate}T12:00:00`).toISOString(), reference: reference.trim() || null, internal_note: internalNote.trim() || null,
          idempotency_key: crypto.randomUUID(),
        };
        persist(String(normalized), true, false); setSubmitted(true);
        await payFinance(document.id, attempt.current);
        setConfirmed(true); paymentRecorded = true; persist(String(normalized), true, true);
      }
      await onRecorded();
      if (paymentRecorded) sessionStorage.removeItem(storageKey(document.id));
    } catch {
      if (paymentRecorded) { persist(String(normalized), true, true); setConfirmed(true); }
      else persist(String(normalized), true, false);
      setError("La confirmation n’a pas pu être affichée. Réessayez ici : la même demande sera reprise, sans nouvel encaissement. Ne créez pas un autre paiement avant vérification de l’historique.");
    } finally { pending.current = false; setBusy(false); }
  }

  const parsedAmount = Number(amount.trim().replace(",", "."));
  const newBalance = Math.max(0, Number(document.balance_due) - (Number.isFinite(parsedAmount) ? parsedAmount : 0));
  const methods = [{ id: "CASH", label: "Espèces", icon: Banknote }, { id: "MOBILE_MONEY", label: "Mobile Money", icon: Smartphone }, { id: "BANK_TRANSFER", label: "Virement bancaire", icon: Landmark }];
  return <form onSubmit={submit} className="space-y-3" aria-label="Enregistrer un paiement">
    <section className="rounded-[7px] bg-[#f7f8f8] p-3">
      <div className="flex items-center justify-between gap-3"><div><strong className="block text-[12px] text-[#303941]">{document.client_name}</strong><span className="text-[10px] text-[#78828a]">{document.dossier_reference || document.document_number} · {document.document_number}</span></div><span className="rounded-full bg-[#fff0dc] px-2 py-1 text-[10px] font-medium text-[#d87320]">{document.status === "PARTIALLY_PAID" ? "Partiellement payée" : document.status === "OVERDUE" ? "En retard" : "À payer"}</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#e5e8e9] pt-3">{[["Total",document.total],["Déjà payé",document.amount_paid],["Solde dû",document.balance_due]].map(([label,value])=><div key={String(label)}><span className="block text-[10px] text-[#78828a]">{label}</span><strong className="text-[11px]">{cash(Number(value),document.currency)}</strong></div>)}</div>
    </section>
    <label className="grid gap-1 text-[11px] font-medium text-[#303941]">Montant reçu ({document.currency}) *<input autoFocus required inputMode="decimal" value={amount} disabled={busy || submitted} onChange={event => { setAmount(event.target.value); if (attempt.current) persist(event.target.value, submitted, confirmed); }} className="h-9 rounded-full border border-[#d8dce0] px-3 text-[13px] outline-none focus:border-[#16855f]" /></label>
    {!submitted && <div className="flex flex-wrap gap-1.5"><button type="button" className="rounded-full border border-[#d9dcdf] px-2.5 py-1 text-[10px] text-[#59636b]" onClick={() => setAmount(String(document.balance_due))}>Payer le solde : {cash(document.balance_due, document.currency)}</button><button type="button" className="rounded-full border border-[#d9dcdf] px-2.5 py-1 text-[10px] text-[#59636b]" onClick={() => setAmount(String(Math.round(Number(document.balance_due) * 50) / 100))}>50 % du solde</button></div>}
    <div className="flex items-center justify-between rounded-[7px] border border-[#e1e4e6] px-3 py-2"><div><span className="block text-[10px] text-[#78828a]">Après ce paiement</span><strong className="text-[11px]">Nouveau solde restant</strong></div><strong className="text-[12px]">{cash(newBalance, document.currency)}</strong></div>
    <fieldset disabled={busy || submitted} className="space-y-1"><legend className="mb-1 text-[11px] font-medium text-[#303941]">Méthode de paiement *</legend>{methods.map(option => { const Icon = option.icon; return <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-[5px] px-1 py-1 text-[12px] text-[#303941]"><input type="radio" name="payment-method" value={option.id} checked={method === option.id} onChange={() => setMethod(option.id)} className="accent-[#111]"/><Icon size={14}/>{option.label}</label>; })}</fieldset>
    <label className="grid gap-1 text-[11px] font-medium text-[#303941]">Date du paiement *<span className="relative"><CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#77818a]"/><input required type="date" value={paidDate} disabled={busy || submitted} onChange={event => setPaidDate(event.target.value)} className="h-9 w-full rounded-full border border-[#d8dce0] pl-9 pr-3 text-[12px]"/></span></label>
    <label className="grid gap-1 text-[11px] font-medium text-[#303941]">Référence du paiement (facultatif)<input value={reference} disabled={busy || submitted} onChange={event => setReference(event.target.value)} placeholder="N° de transaction ou référence" className="h-9 rounded-[6px] border border-[#d8dce0] px-3 text-[12px] font-normal"/></label>
    <label className="grid gap-1 text-[11px] font-medium text-[#303941]">Note interne (facultatif)<textarea value={internalNote} disabled={busy || submitted} onChange={event => setInternalNote(event.target.value)} placeholder="Ajouter un commentaire…" className="min-h-[54px] resize-y rounded-[6px] border border-[#d8dce0] px-3 py-2 text-[12px] font-normal outline-none focus:border-[#16855f]"/></label>
    <p className="text-[10px] leading-4 text-[#78828a]">Si la connexion est interrompue, votre demande est conservée pour vérifier le paiement sans l’enregistrer une deuxième fois.</p>
    {error && <p role="alert" className="text-[12px] text-red-700">{error}</p>}
    {!error && !submitted && parsedAmount > Number(document.balance_due) && <p role="alert" className="text-[12px] text-red-700">Le montant doit être au maximum égal au solde restant.</p>}
    <div className="flex justify-end gap-2 border-t border-[#e8eaec] pt-3">
      {!submitted && <button type="button" disabled={busy} onClick={() => { sessionStorage.removeItem(storageKey(document.id)); onCancel(); }} className="h-9 rounded-full border border-[#d9dcdf] px-3 text-[12px]">Effacer</button>}
      <button disabled={busy || (!submitted && (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > Number(document.balance_due)))} type="submit" className="h-9 rounded-full bg-[#111] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "Enregistrement…" : confirmed ? "Actualiser le paiement confirmé" : submitted ? "Vérifier la même demande" : "Enregistrer"}</button>
    </div>
  </form>;
}
