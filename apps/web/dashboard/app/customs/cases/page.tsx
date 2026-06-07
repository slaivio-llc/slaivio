"use client";

import { useEffect, useState } from "react";

import { getCustomsCases } from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";

type CustomsCase = {
  id: string;
  case_code: string;
  customs_status: string;
  risk_level: string;
  goods_description: string | null;
  blocked_reason: string | null;
  opened_by_name: string | null;
  created_at: string;
};

export default function CustomsCasesPage() {
  const [cases, setCases] = useState<CustomsCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setCases(await getCustomsCases());
    } catch {
      setError("Impossible de charger les dossiers douane.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <CargoPageShell
      title="Customs Cases"
      description="Douane, compliance, risques et blocages opérationnels."
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <CargoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Cas douane</h2>
          <RefreshButton onClick={load} />
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && cases.length === 0 && (
            <EmptyState label="Aucun cas douane pour le moment." />
          )}
          {cases.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-950">{item.case_code}</div>
                <StatusPill
                  label={item.customs_status}
                  tone={item.customs_status === "RESOLVED" ? "success" : "warning"}
                />
              </div>
              <div className="mt-2 text-slate-500">
                Risque : {item.risk_level} • {item.goods_description || "-"}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-400">
                {item.blocked_reason || "Aucun blocage renseigné"}
              </div>
            </div>
          ))}
        </div>
      </CargoCard>
    </CargoPageShell>
  );
}
