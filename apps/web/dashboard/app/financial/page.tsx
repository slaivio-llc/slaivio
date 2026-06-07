"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Wallet } from "lucide-react";

import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  MetricCard,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";
import {
  FinancialDashboard,
  getFinancialDashboard,
} from "@/services/financial-dashboard";

function formatMoney(amountMinor: number, currencyCode = "USD") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
  }).format((amountMinor || 0) / 100);
}

export default function FinancialPage() {
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const data = await getFinancialDashboard();
      setDashboard(data);
    } catch {
      setError("Impossible de charger le dashboard financier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <CargoPageShell
      eyebrow="Cargo Finance"
      title="Financial OS"
      description="Suivez revenus, coûts, wallet, facturation et événements financiers depuis un cockpit clair pour les agences cargo."
      action={<RefreshButton onClick={loadDashboard} />}
    >
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && <EmptyState label="Chargement du dashboard financier..." />}

      {dashboard && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Revenus"
              value={formatMoney(dashboard.totals.revenue_minor)}
              hint="Paiements reçus et revenus comptabilisés"
            />
            <MetricCard
              label="Coûts"
              value={formatMoney(dashboard.totals.cost_minor)}
              hint="Dépenses, frais et débits wallet"
            />
            <MetricCard
              label="Net"
              value={formatMoney(dashboard.totals.net_minor)}
              hint="Marge opérationnelle actuelle"
            />
            <MetricCard
              label="Wallet"
              value={formatMoney(dashboard.wallet.balance_minor)}
              hint={`${dashboard.wallet.wallet_count} wallet(s) actif(s)`}
            />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <CargoCard>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Facturation SaaS
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Encaissements et reste à recevoir.
                  </p>
                </div>
                <CreditCard className="text-sky-500" size={24} />
              </div>

              <div className="mt-6 space-y-3">
                <FinanceLine
                  label="Total facturé"
                  value={formatMoney(dashboard.invoices.total_invoiced_minor)}
                />
                <FinanceLine
                  label="Payé"
                  value={formatMoney(dashboard.invoices.paid_minor)}
                  tone="success"
                />
                <FinanceLine
                  label="À encaisser"
                  value={formatMoney(dashboard.invoices.outstanding_minor)}
                  tone="warning"
                />
                <FinanceLine
                  label="Factures"
                  value={String(dashboard.invoices.invoice_count)}
                />
              </div>
            </CargoCard>

            <CargoCard>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Cashflow récent
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Entrées et sorties par journée opérationnelle.
                  </p>
                </div>
                <Wallet className="text-emerald-500" size={24} />
              </div>

              <div className="mt-6 space-y-3">
                {dashboard.cashflow.length === 0 && (
                  <EmptyState label="Aucun mouvement récent." />
                )}

                {dashboard.cashflow.map((item) => (
                  <div
                    key={item.day}
                    className="rounded-3xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-950">{item.day}</div>
                      <StatusPill label="Cashflow" tone="info" />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <CashflowBox
                        icon={<ArrowDownLeft size={16} />}
                        label="Entrées"
                        value={formatMoney(item.inflow_minor)}
                        tone="success"
                      />
                      <CashflowBox
                        icon={<ArrowUpRight size={16} />}
                        label="Sorties"
                        value={formatMoney(item.outflow_minor)}
                        tone="danger"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CargoCard>
          </section>

          <CargoCard>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Événements récents
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Journal financier opérationnel.
                </p>
              </div>
              <StatusPill label="Live Ledger" tone="success" />
            </div>

            <div className="mt-6 space-y-3">
              {dashboard.recent_events.length === 0 && (
                <EmptyState label="Aucun événement financier pour le moment." />
              )}

              {dashboard.recent_events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-950">
                      {event.event_type}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {event.description || "Sans description"}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="font-black text-slate-950">
                      {formatMoney(event.amount_minor, event.currency_code || "USD")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(event.created_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CargoCard>
        </>
      )}
    </CargoPageShell>
  );
}

function FinanceLine({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const valueClass = {
    neutral: "text-slate-950",
    success: "text-emerald-700",
    warning: "text-amber-700",
  }[tone];

  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-black ${valueClass}`}>{value}</span>
    </div>
  );
}

function CashflowBox({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-red-50 text-red-700";

  return (
    <div className={`rounded-2xl p-3 text-sm ${toneClass}`}>
      <div className="flex items-center gap-2 font-bold">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-lg font-black">{value}</div>
    </div>
  );
}
