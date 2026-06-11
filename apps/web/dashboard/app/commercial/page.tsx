"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  Sparkles,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  CommercialCase,
  CommercialQuote,
  CommercialTask,
  getCommercialCases,
  getCommercialQuotes,
  getCommercialTasks,
  processCommercialMessage,
} from "@/services/commercial";

function money(
  amountMinor: number | null,
  currency: string | null
) {
  if (amountMinor === null || !currency) {
    return "A verifier";
  }

  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

export default function CommercialPage() {
  const [phone, setPhone] = useState("243840178047");
  const [message, setMessage] = useState(
    "Prix Chine Kinshasa 50kg telephone par air"
  );
  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [quotes, setQuotes] = useState<CommercialQuote[]>([]);
  const [tasks, setTasks] = useState<CommercialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [resultLabel, setResultLabel] = useState("");

  async function loadCommercial() {
    setError("");

    try {
      const [caseData, quoteData, taskData] = await Promise.all([
        getCommercialCases(),
        getCommercialQuotes(),
        getCommercialTasks(),
      ]);
      setCases(caseData);
      setQuotes(quoteData);
      setTasks(taskData);
    } catch {
      setError("Impossible de charger le moteur commercial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCommercial();
  }, []);

  async function runCommercialMessage() {
    setRunning(true);
    setError("");
    setResultLabel("");

    try {
      const result = await processCommercialMessage({
        phone,
        message,
        source_channel: "dashboard",
      });
      setResultLabel(`${result.intent || "COMMERCIAL"} - ${result.status}`);
      await loadCommercial();
    } catch {
      setError("Impossible de traiter ce message commercial.");
    } finally {
      setRunning(false);
    }
  }

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status === "OPEN").length,
    [tasks]
  );
  const draftQuotes = useMemo(
    () => quotes.filter((quote) => quote.status === "DRAFT").length,
    [quotes]
  );
  const needsInfo = useMemo(
    () => cases.filter((item) => item.status === "NEEDS_INFO").length,
    [cases]
  );

  return (
    <DashboardLayout>
      <main className="p-4 md:p-8">
        <section className="slaivo-gradient-card rounded-[2rem] p-7 text-white md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                <BadgeDollarSign size={14} />
                Commercial Engine L1.0
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Transformez chaque demande WhatsApp en dossier commercial.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                SLAIVIO detecte les intentions, cree le dossier, verifie les
                restrictions, resout le service shipping et prepare le devis ou
                la tache equipe.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-200">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="font-black">Tester un message</h2>
                  <p className="text-sm text-slate-300">
                    Prix, achat ou restriction.
                  </p>
                </div>
              </div>

              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-5 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
                placeholder="Telephone client"
              />

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-3 min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
                placeholder="Message client..."
              />

              <button
                onClick={runCommercialMessage}
                disabled={running}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {running ? "Traitement..." : "Lancer Commercial Engine"}
                <ArrowRight size={16} />
              </button>

              {resultLabel && (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">
                  {resultLabel}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Kpi label="Cases" value={String(cases.length)} />
          <Kpi label="Draft quotes" value={String(draftQuotes)} />
          <Kpi label="Needs info" value={String(needsInfo)} />
          <Kpi label="Open tasks" value={String(openTasks)} />
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <div className="slaivo-card overflow-hidden rounded-[2rem]">
            <div className="border-b border-slate-100 p-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Commercial cases
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Demandes recentes
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {loading && (
                <div className="p-5 text-sm font-semibold text-slate-500">
                  Chargement...
                </div>
              )}

              {!loading && cases.length === 0 && (
                <div className="p-5 text-sm font-semibold text-slate-500">
                  Aucune demande commerciale.
                </div>
              )}

              {cases.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 p-5"
                >
                  <div>
                    <div className="font-black text-slate-950">
                      {item.case_type}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {item.last_customer_message || "Demande dashboard"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill>{item.status}</Pill>
                      <Pill>{item.priority}</Pill>
                    </div>
                  </div>
                  <CheckCircle2 className="text-emerald-500" size={18} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="slaivo-card overflow-hidden rounded-[2rem]">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-xl font-black text-slate-950">
                  Devis generes
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {quotes.slice(0, 6).map((quote) => (
                  <div key={quote.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-slate-950">
                        {quote.service_name || "Service a verifier"}
                      </div>
                      <Pill>{quote.status}</Pill>
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-950">
                      {money(quote.total_minor, quote.currency_code)}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      ETA {quote.eta_min_days || "?"}-{quote.eta_max_days || "?"} jours
                      · {quote.restriction_decision || "Restriction inconnue"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="slaivo-card overflow-hidden rounded-[2rem]">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-xl font-black text-slate-950">
                  Taches equipe
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="flex gap-3 p-5">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                      <ClipboardList size={16} />
                    </div>
                    <div>
                      <div className="font-black text-slate-950">
                        {task.title}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {task.description || task.task_type}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Pill>{task.priority}</Pill>
                        <Pill>{task.assigned_team || "TEAM"}</Pill>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}

function Kpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="slaivo-card rounded-[1.5rem] p-5">
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function Pill({
  children,
}: {
  children: string;
}) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
      {children}
    </span>
  );
}
