"use client";
import {dashboardText,useDashboardMessages,dashboardFormatLocale} from '@/components/i18n/dashboard-messages';


import { useEffect, useState } from "react";
import { ChevronRight, Search, UserRound } from "lucide-react";
import { OperationButton } from "@/components/ui/operation-controls";
import { TableSkeleton } from "@/components/ui/page-state";
import { api } from "@/services/api";

type Entry = {
  id: string;
  client_reference: string;
  display_name: string;
  phone: string | null;
  country: string | null;
  customer_type: string;
  package_count: number | null;
  balance_due?: number;
  balance_currency?: string | null;
  balance_currency_count?: number;
};
type Summary = { total: number; active: number; due: number | null; finance_visible: boolean; packages_visible: boolean };
type Result = { items: Entry[]; total: number; page: number; total_pages: number; summary: Summary };
type View = "all" | "due" | "current";

const inputClass = "h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(dashboardFormatLocale(), { maximumFractionDigits: 2 }).format(value) + " " + currency;
}

function maskPhone(phone: string | null) {
  if (!phone) return "Téléphone non renseigné";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${phone.slice(0, Math.max(3, phone.length - 6))}${"*".repeat(3)}${phone.slice(-3)}`;
}

export function CargoDirectory({ open, revision, create = () => undefined }: {
  open: (id: string) => void;
  revision: number;
  create?: () => void;
}) {
  useDashboardMessages();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      api.get<Result>("/clients/directory", {
        params: { q: query, page, sort: "name_asc", balance_status: view === "all" ? undefined : view },
        signal: controller.signal,
      }).then(response => {
        if (!controller.signal.aborted) setResult(response.data);
      }).catch(() => {
        if (!controller.signal.aborted) setError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page, view, retry, revision]);

  const summary = result?.summary;
  const tabs: { key: View; label: string }[] = [
    { key: "all", label: "Tous" },
    ...(summary?.finance_visible ? [{ key: "due" as const, label: "Solde dû" }, { key: "current" as const, label: "À jour" }] : []),
  ];

  return <section className="mx-auto w-full px-6 py-6 sm:px-8" aria-label={dashboardText("Répertoire clients")}>
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{dashboardText("Clients")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{dashboardText("Répertoire et suivi des clients")}</p>
        </div>
        <OperationButton type="button" variant="primary" onClick={create}><span className="text-lg leading-none">+</span>{dashboardText("Nouveau client")}</OperationButton>
      </header>

      <div className={`grid grid-cols-1 gap-3 py-4 sm:grid-cols-2 ${summary?.finance_visible ? "lg:grid-cols-3" : ""}`}>
        <Metric label={dashboardText("Total clients")} value={summary?.total} />
        {summary?.packages_visible && <Metric label={dashboardText("Clients actifs")} value={summary.active} />}
        {summary?.finance_visible && <Metric label={dashboardText("Avec solde dû")} value={summary.due} />}
      </div>

      <div>
        <label className="relative block">
          <Search size={16} aria-hidden="true" className="absolute left-4 top-3 text-slate-400" />
          <input type="search" maxLength={120} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} aria-label={dashboardText("Rechercher un nom, téléphone ou référence")} placeholder={dashboardText("Rechercher un nom, téléphone ou référence...")} className={`${inputClass} pl-10`} />
        </label>
        <nav className="mt-3 flex items-center gap-1" aria-label={dashboardText("Filtrer les clients")}>
          {tabs.map(tab => <button key={tab.key} type="button" aria-pressed={view === tab.key} onClick={() => { setView(tab.key); setPage(1); }} className={`rounded-full px-3 py-1.5 text-sm transition ${view === tab.key ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}>{dashboardText(tab.label)}</button>)}
        </nav>
      </div>

      {error ? <div role="alert" className="p-8 text-center text-sm text-slate-600">{dashboardText("Impossible de charger les clients. ")}<button type="button" onClick={() => setRetry(value => value + 1)} className="font-medium underline">{dashboardText("Réessayer")}</button></div>
        : loading ? <div className="py-4"><TableSkeleton rows={5} columns={3} label={dashboardText("Chargement des clients")} /></div>
        : !result?.items.length ? <div className="px-6 py-16 text-center"><p className="text-sm font-medium text-slate-800">{query || view !== "all" ? dashboardText("Aucun client correspondant") : dashboardText("Aucun client pour le moment")}</p><p className="mt-1 text-sm text-slate-500">{query || view !== "all" ? dashboardText("Modifiez votre recherche ou votre filtre.") : dashboardText("Utilisez Nouveau client pour enregistrer votre premier client.")}</p></div>
        : <ul className="mt-1 divide-y divide-slate-100 border-t border-slate-100">
          {result.items.map(client => <li key={client.id}>
            <button type="button" onClick={() => open(client.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 sm:grid-cols-[minmax(0,1fr)_auto_auto_16px]">
              <span className="flex min-w-0 items-center gap-3"><UserRound size={16} aria-hidden="true" className="shrink-0 text-slate-500" /><span className="min-w-0"><strong className="block truncate text-sm font-medium text-slate-900">{client.display_name || dashboardText("Sans nom")}</strong><span className="block truncate text-xs text-slate-500">{maskPhone(client.phone)}{client.country ? ` · ${client.country}` : ""}</span></span></span>
              <span className="text-right text-sm text-slate-700">{client.package_count ?? "—"} {dashboardText(" colis")}</span>
              <span className="text-right text-sm">{client.balance_currency_count && client.balance_currency_count > 1 ? <span className="text-slate-500">{dashboardText("Multi-devises")}</span> : client.balance_due ? <span className="text-red-600">{formatMoney(client.balance_due, client.balance_currency || "")}</span> : summary?.finance_visible ? <span className="text-emerald-600">{dashboardText("À jour")}</span> : null}</span>
              <ChevronRight size={15} aria-hidden="true" className="text-slate-400" />
            </button>
          </li>)}
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-slate-500 sm:px-7"><span>{result.total === 0 ? dashboardText("0 client") : dashboardText("{0}–{1} sur {2}", (page - 1) * 50 + 1, Math.min(page * 50, result.total), result.total)}</span><span className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">{dashboardText("Précédent")}</button><button type="button" disabled={page >= result.total_pages} onClick={() => setPage(value => value + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">{dashboardText("Suivant")}</button></span></li>
        </ul>}
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value?: number | null }) {
  useDashboardMessages();
  return <div className="min-w-0 px-2 py-1"><p className="text-xs text-slate-500">{dashboardText(label)}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value == null ? "—" : value.toLocaleString(dashboardFormatLocale())}</p></div>;
}
