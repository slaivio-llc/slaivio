"use client";

import { useEffect, useState } from "react";
import {
  getOpenSasPayAttempt,
  getSasPayAttempt,
  reconcileSasPayCheckout,
  startSasPayCheckout,
  type FinanceDocument,
  type SasPayAttempt,
} from "@/services/finance";

const storageKey = (documentId: string) => `finance:saspay:${documentId}`;

function errorMessage(error: unknown) {
  const code = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  if (code === "saspay_merchant_not_configured") return "SasPay n’est pas encore configuré pour cette agence.";
  if (code === "saspay_attempt_requires_manual_reconciliation") return "Cette tentative a un résultat incertain. Ne relancez pas le paiement ; une vérification manuelle est nécessaire.";
  if (code === "saspay_attempt_already_open") return "Une tentative SasPay est déjà ouverte pour cette facture. Retrouvez-la ci-dessous et vérifiez son statut.";
  return "Impossible de démarrer ou vérifier le paiement SasPay. La demande existante est conservée.";
}

export function SasPayCheckout({ document, onConfirmed }: {
  document: FinanceDocument;
  onConfirmed: () => Promise<void>;
}) {
  const [attempt, setAttempt] = useState<SasPayAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const savedId = window.sessionStorage.getItem(storageKey(document.id));
    const request = savedId
      ? getSasPayAttempt(document.id, savedId)
      : getOpenSasPayAttempt(document.id);
    request.then((current) => {
      if (!active || !current) return;
      setAttempt(current);
      window.sessionStorage.setItem(storageKey(document.id), current.id);
    }).catch(() => {
      if (active && savedId) setError("La tentative SasPay précédente n’a pas pu être relue. Vérifiez son statut avant d’en créer une autre.");
    });
    return () => { active = false; };
  }, [document.id]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      if (retryAllowed) {
        window.sessionStorage.removeItem(storageKey(document.id));
        window.sessionStorage.removeItem(`${storageKey(document.id)}:request`);
      }
      const requestKey = window.sessionStorage.getItem(`${storageKey(document.id)}:request`) || crypto.randomUUID();
      window.sessionStorage.setItem(`${storageKey(document.id)}:request`, requestKey);
      const created = await startSasPayCheckout(document.id, requestKey);
      setAttempt(created);
      window.sessionStorage.setItem(storageKey(document.id), created.id);
    } catch (e) {
      setError(errorMessage(e));
      try {
        const current = await getOpenSasPayAttempt(document.id);
        if (current) {
          setAttempt(current);
          window.sessionStorage.setItem(storageKey(document.id), current.id);
        }
      } catch {
        setError(`${errorMessage(e)} Une vérification serveur reste nécessaire avant toute nouvelle tentative.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const result = await reconcileSasPayCheckout(document.id, attempt.id);
      if (result.status === "SUCCEEDED") {
        setAttempt(await getSasPayAttempt(document.id, attempt.id));
        await onConfirmed();
      } else {
        setAttempt(await getSasPayAttempt(document.id, attempt.id));
        setError("SasPay n’a pas encore confirmé le paiement. Le solde Finance reste inchangé.");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const open = attempt && ["CREATING", "PENDING", "AMBIGUOUS"].includes(attempt.status);
  const retryAllowed = attempt && ["FAILED", "CANCELLED"].includes(attempt.status);

  return <section className="space-y-2 rounded-lg border border-[#e5e8eb] p-4" aria-label="Paiement SasPay">
    <div>
      <h3 className="text-sm font-semibold">Paiement en ligne SasPay</h3>
      <p className="mt-1 text-xs text-slate-500">Le paiement n’est enregistré dans Finance qu’après vérification côté SasPay.</p>
    </div>
    {!open && attempt?.status !== "SUCCEEDED" && <button type="button" disabled={busy || (!retryAllowed && !!attempt)} onClick={start} className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">
      {busy ? "Préparation…" : retryAllowed ? "Nouvelle tentative SasPay" : "Créer le lien de paiement"}
    </button>}
    {attempt?.checkout_url && attempt.status === "PENDING" && <a href={attempt.checkout_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium">
      Ouvrir le paiement SasPay
    </a>}
    {open && <button type="button" disabled={busy} onClick={reconcile} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium disabled:opacity-50">
      {busy ? "Vérification…" : "Vérifier le statut auprès de SasPay"}
    </button>}
    {attempt?.status === "SUCCEEDED" && <p className="text-sm text-emerald-700">Paiement vérifié et enregistré dans Finance.</p>}
    {attempt?.status === "AMBIGUOUS" && <p className="text-xs text-amber-800">Résultat de création incertain : aucune nouvelle session ne sera créée automatiquement.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
