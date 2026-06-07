"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
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

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      <div className="mt-2 text-xs text-gray-500">{hint}</div>
    </div>
  );
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
    <DashboardLayout>
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial OS</h1>
            <p className="mt-2 text-sm text-gray-500">
              Revenus, wallet, factures et événements financiers SLAIVIO.
            </p>
          </div>

          <button
            onClick={loadDashboard}
            className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            Rafraîchir
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-2xl border bg-white p-6 text-sm text-gray-500">
            Chargement...
          </div>
        )}

        {dashboard && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-4">
              <KpiCard
                label="Revenus"
                value={formatMoney(dashboard.totals.revenue_minor)}
                hint="Revenus et paiements reçus"
              />
              <KpiCard
                label="Coûts"
                value={formatMoney(dashboard.totals.cost_minor)}
                hint="Dépenses et débits wallet"
              />
              <KpiCard
                label="Net"
                value={formatMoney(dashboard.totals.net_minor)}
                hint="Revenus moins coûts"
              />
              <KpiCard
                label="Wallet"
                value={formatMoney(dashboard.wallet.balance_minor)}
                hint={`${dashboard.wallet.wallet_count} wallet(s) actif(s)`}
              />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Facturation SaaS</h2>
                <div className="mt-5 grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total facturé</span>
                    <span className="font-semibold">
                      {formatMoney(dashboard.invoices.total_invoiced_minor)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payé</span>
                    <span className="font-semibold">
                      {formatMoney(dashboard.invoices.paid_minor)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">À encaisser</span>
                    <span className="font-semibold">
                      {formatMoney(dashboard.invoices.outstanding_minor)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Factures</span>
                    <span className="font-semibold">
                      {dashboard.invoices.invoice_count}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Cashflow récent</h2>
                <div className="mt-5 space-y-3">
                  {dashboard.cashflow.length === 0 && (
                    <div className="text-sm text-gray-500">
                      Aucun mouvement récent.
                    </div>
                  )}

                  {dashboard.cashflow.map((item) => (
                    <div
                      key={item.day}
                      className="rounded-xl bg-gray-50 p-3 text-sm"
                    >
                      <div className="font-medium">{item.day}</div>
                      <div className="mt-2 flex justify-between text-xs text-gray-500">
                        <span>Entrées {formatMoney(item.inflow_minor)}</span>
                        <span>Sorties {formatMoney(item.outflow_minor)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Événements récents</h2>

              <div className="mt-5 divide-y">
                {dashboard.recent_events.length === 0 && (
                  <div className="text-sm text-gray-500">
                    Aucun événement financier pour le moment.
                  </div>
                )}

                {dashboard.recent_events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between py-4 text-sm"
                  >
                    <div>
                      <div className="font-semibold">{event.event_type}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {event.description || "Sans description"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">
                        {formatMoney(
                          event.amount_minor,
                          event.currency_code || "USD"
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(event.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}

