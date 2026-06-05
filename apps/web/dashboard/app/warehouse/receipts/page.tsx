"use client";

import { useEffect, useState } from "react";

import { getWarehouseReceipts } from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
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
          <h2 className="text-lg font-semibold">Réceptions</h2>
          <button onClick={load} className="rounded-xl border px-4 py-2 text-sm">
            Rafraîchir
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && receipts.length === 0 && (
            <EmptyState label="Aucune réception pour le moment." />
          )}
          {receipts.map((receipt) => (
            <div key={receipt.id} className="rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{receipt.receipt_code}</div>
                <span className="rounded-full border px-2 py-1 text-xs">
                  {receipt.package_condition || "UNKNOWN"}
                </span>
              </div>
              <div className="mt-2 text-gray-500">
                Fournisseur : {receipt.supplier_name || "-"}
              </div>
              <div className="mt-2 text-xs text-gray-500">
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

