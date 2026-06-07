"use client";

import { useEffect, useState } from "react";

import { getWarehouseReceipts } from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";

type Receipt = {
  id: string;
  receipt_code: string;
  package_condition: string | null;
  supplier_name: string | null;
  measured_weight_kg: number | null;
  received_by_name: string | null;
  received_at: string;
};

export default function WarehouseReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setReceipts(await getWarehouseReceipts());
    } catch {
      setError("Impossible de charger les réceptions warehouse.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <CargoPageShell
      title="Warehouse Receipts"
      description="Réceptions warehouse, poids mesuré et état colis."
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <CargoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Réceptions</h2>
          <RefreshButton onClick={load} />
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && receipts.length === 0 && (
            <EmptyState label="Aucune réception pour le moment." />
          )}
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-950">
                  {receipt.receipt_code}
                </div>
                <StatusPill
                  label={receipt.package_condition || "UNKNOWN"}
                  tone={receipt.package_condition === "GOOD" ? "success" : "warning"}
                />
              </div>
              <div className="mt-2 text-slate-500">
                Fournisseur : {receipt.supplier_name || "-"}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-400">
                Poids : {receipt.measured_weight_kg || "-"} kg • Reçu par{" "}
                {receipt.received_by_name || "-"}
              </div>
            </div>
          ))}
        </div>
      </CargoCard>
    </CargoPageShell>
  );
}
