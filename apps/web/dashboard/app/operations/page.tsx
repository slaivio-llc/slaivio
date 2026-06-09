"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Play,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  EmptyState,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";
import {
  acknowledgeInsight,
  dismissInsight,
  getOperationalInsights,
  OperationalInsight,
  resolveInsight,
  runOperationsDetection,
} from "@/services/operations";

const severityOrder = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export default function OperationsPage() {
  const [insights, setInsights] = useState<OperationalInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadInsights() {
    setError("");

    try {
      const data = await getOperationalInsights({
        limit: 100,
      });
      setInsights(data);
    } catch {
      setError("Impossible de charger les insights operations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, []);

  async function runDetection() {
    setRunning(true);
    setError("");

    try {
      await runOperationsDetection();
      await loadInsights();
    } catch {
      setError("Impossible d'executer la detection operations.");
    } finally {
      setRunning(false);
    }
  }

  async function updateInsight(
    id: string,
    action: "acknowledge" | "resolve" | "dismiss"
  ) {
    try {
      if (action === "acknowledge") {
        await acknowledgeInsight(id);
      } else if (action === "resolve") {
        await resolveInsight(id);
      } else {
        await dismissInsight(id);
      }

      await loadInsights();
    } catch {
      setError("Impossible de mettre a jour cet insight.");
    }
  }

  const grouped = useMemo(() => {
    return severityOrder.map((severity) => ({
      severity,
      items: insights.filter(
        (item) =>
          item.severity === severity &&
          item.status !== "RESOLVED" &&
          item.status !== "DISMISSED"
      ),
    }));
  }, [insights]);

  const resolved = insights.filter(
    (item) => item.status === "RESOLVED" || item.status === "DISMISSED"
  );
  const openCount = insights.filter(
    (item) => item.status === "OPEN"
  ).length;
  const criticalCount = insights.filter(
    (item) => item.severity === "CRITICAL" && item.status !== "RESOLVED"
  ).length;
  const delayedCount = insights.filter(
    (item) => item.insight_type === "SHIPMENT_DELAYED"
  ).length;
  const stuckCount = insights.filter(
    (item) => item.insight_type === "WAREHOUSE_STUCK"
  ).length;

  return (
    <DashboardLayout>
      <main className="p-4 md:p-8">
        <section className="slaivo-gradient-card rounded-[2rem] p-7 text-white md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
                <ShieldAlert size={14} />
                Operations Intelligence
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Detectez les blocages avant qu'ils deviennent des urgences.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                SLAIVIO analyse shipments, warehouse, delivery, paiements et wallet
                avec des regles operations controlables pour prioriser les actions.
              </p>
            </div>

            <button
              onClick={runDetection}
              disabled={running}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Play size={16} />
              {running ? "Detection..." : "Run detection"}
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Kpi label="Open insights" value={String(openCount)} />
          <Kpi label="Critical alerts" value={String(criticalCount)} />
          <Kpi label="Delayed shipments" value={String(delayedCount)} />
          <Kpi label="Stuck warehouse" value={String(stuckCount)} />
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.75fr]">
          <div className="space-y-6">
            {loading && (
              <div className="slaivo-card rounded-[2rem] p-6 text-sm text-slate-500">
                Chargement des insights...
              </div>
            )}

            {!loading &&
              grouped.map((group) => (
                <div
                  key={group.severity}
                  className="slaivo-card overflow-hidden rounded-[2rem]"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 p-5">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        Priority
                      </div>
                      <h2 className="mt-1 text-xl font-black text-slate-950">
                        {group.severity}
                      </h2>
                    </div>
                    <StatusPill label={`${group.items.length} issue(s)`} />
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.items.length === 0 && (
                      <div className="p-5">
                        <EmptyState label="Aucun insight dans cette severite." />
                      </div>
                    )}

                    {group.items.map((insight) => (
                      <InsightRow
                        key={insight.id}
                        insight={insight}
                        onAction={updateInsight}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>

          <aside className="slaivo-card rounded-[2rem] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="font-black text-slate-950">
                  Resolved issues
                </h2>
                <p className="text-sm text-slate-500">
                  Historique recent des decisions operations.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {resolved.length === 0 && (
                <EmptyState label="Aucun insight resolu." />
              )}

              {resolved.slice(0, 12).map((insight) => (
                <div
                  key={insight.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-950">
                      {insight.title}
                    </div>
                    <StatusPill label={insight.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </DashboardLayout>
  );
}

function InsightRow({
  insight,
  onAction,
}: {
  insight: OperationalInsight;
  onAction: (
    id: string,
    action: "acknowledge" | "resolve" | "dismiss"
  ) => void;
}) {
  return (
    <div className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={insight.insight_type} />
            <StatusPill label={insight.status} />
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">
            {insight.title}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {insight.message}
          </p>
          {insight.recommended_action && (
            <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800">
              {insight.recommended_action}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onAction(insight.id, "acknowledge")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
          >
            <Eye size={14} />
            Acknowledge
          </button>
          <button
            onClick={() => onAction(insight.id, "resolve")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
          >
            <CheckCircle2 size={14} />
            Resolve
          </button>
          <button
            onClick={() => onAction(insight.id, "dismiss")}
            className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
          >
            <XCircle size={14} />
            Dismiss
          </button>
        </div>
      </div>
    </div>
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
    <div className="slaivo-card rounded-3xl p-5">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </div>
    </div>
  );
}
