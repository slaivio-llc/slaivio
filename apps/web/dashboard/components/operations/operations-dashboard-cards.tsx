"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getOperationalInsights,
  OperationalInsight,
} from "@/services/operations";

export function OperationsDashboardCards() {
  const [insights, setInsights] = useState<OperationalInsight[]>([]);

  useEffect(() => {
    getOperationalInsights({
      limit: 100,
    })
      .then(setInsights)
      .catch(() => setInsights([]));
  }, []);

  const metrics = useMemo(() => {
    const active = insights.filter(
      (item) =>
        item.status !== "RESOLVED" &&
        item.status !== "DISMISSED"
    );

    return {
      open: active.filter((item) => item.status === "OPEN").length,
      critical: active.filter((item) => item.severity === "CRITICAL").length,
      delayed: active.filter(
        (item) => item.insight_type === "SHIPMENT_DELAYED"
      ).length,
      stuck: active.filter(
        (item) => item.insight_type === "WAREHOUSE_STUCK"
      ).length,
    };
  }, [insights]);

  return (
    <section className="mt-8 grid gap-4 md:grid-cols-4">
      <OpsKpi label="Open insights" value={String(metrics.open)} />
      <OpsKpi label="Critical alerts" value={String(metrics.critical)} />
      <OpsKpi label="Delayed shipments" value={String(metrics.delayed)} />
      <OpsKpi label="Stuck warehouse" value={String(metrics.stuck)} />
    </section>
  );
}

function OpsKpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="slaivo-card rounded-3xl border-emerald-100 bg-emerald-50/40 p-5">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-xs text-emerald-700">
        Operations intelligence
      </div>
    </div>
  );
}
