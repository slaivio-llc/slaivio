"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Camera,
  ClipboardCheck,
  PackageCheck,
  RefreshCw,
  Scale,
  Search,
  Warehouse,
} from "lucide-react";

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
  shipment_id?: string | null;
  package_condition: string | null;
  supplier_name: string | null;
  supplier_phone?: string | null;
  package_label?: string | null;
  measured_weight_kg: number | null;
  measured_volume_cbm?: number | null;
  received_by_name: string | null;
  notes?: string | null;
  received_at: string;
};

const conditionOptions = [
  "ALL",
  "GOOD",
  "DAMAGED",
  "UNKNOWN",
  "MISMATCH",
];

export default function WarehouseReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [conditionFilter, setConditionFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setReceipts(await getWarehouseReceipts());
    } catch {
      setError("Impossible de charger les receptions warehouse.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const condition = receipt.package_condition || "UNKNOWN";

      if (conditionFilter !== "ALL" && condition !== conditionFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        receipt.receipt_code,
        receipt.supplier_name,
        receipt.supplier_phone,
        receipt.package_label,
        receipt.received_by_name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedQuery)
        );
    });
  }, [conditionFilter, query, receipts]);

  const metrics = useMemo(() => {
    const damaged = receipts.filter(
      (receipt) => receipt.package_condition === "DAMAGED"
    ).length;
    const unidentified = receipts.filter(
      (receipt) => !receipt.package_label
    ).length;
    const totalWeight = receipts.reduce(
      (total, receipt) => total + Number(receipt.measured_weight_kg || 0),
      0
    );

    return {
      total: receipts.length,
      damaged,
      unidentified,
      totalWeight,
    };
  }, [receipts]);

  return (
    <CargoPageShell
      eyebrow="Warehouse Operations"
      title="Warehouse Receiving"
      description="Controlez les colis recus, les fournisseurs, les poids mesures, les colis inconnus et les anomalies avant groupage."
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric
          icon={<PackageCheck size={18} />}
          label="Received"
          value={String(metrics.total)}
          hint="Colis recus"
          tone="info"
        />
        <Metric
          icon={<AlertTriangle size={18} />}
          label="Damaged"
          value={String(metrics.damaged)}
          hint="A verifier"
          tone={metrics.damaged ? "danger" : "success"}
        />
        <Metric
          icon={<Search size={18} />}
          label="Unidentified"
          value={String(metrics.unidentified)}
          hint="Sans shipping mark"
          tone={metrics.unidentified ? "warning" : "success"}
        />
        <Metric
          icon={<Scale size={18} />}
          label="Measured"
          value={`${metrics.totalWeight.toFixed(1)} kg`}
          hint="Poids total connu"
          tone="neutral"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <CargoCard>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Warehouse size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Receiving Queue
              </h2>
              <p className="text-sm text-slate-500">
                Filtrer les receptions.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Search
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Receipt, supplier, mark..."
                className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Condition
              </span>
              <select
                value={conditionFilter}
                onChange={(event) => setConditionFilter(event.target.value)}
                className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {conditionOptions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-black text-slate-950">
                Workflow attendu
              </div>
              <div className="mt-3 space-y-2">
                <Step label="Identifier shipping mark" />
                <Step label="Mesurer poids / volume" />
                <Step label="Ajouter photos ou preuves" />
                <Step label="Notifier client" />
              </div>
            </div>
          </div>
        </CargoCard>

        <CargoCard>
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Receptions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredReceipts.length} reception(s) affichee(s)
              </p>
            </div>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-2">
            {loading && <EmptyState label="Chargement..." />}
            {!loading && filteredReceipts.length === 0 && (
              <EmptyState label="Aucune reception pour ce filtre." />
            )}
            {filteredReceipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>
        </CargoCard>
      </section>
    </CargoPageShell>
  );
}

function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const condition = receipt.package_condition || "UNKNOWN";
  const tone =
    condition === "GOOD"
      ? "success"
      : condition === "DAMAGED"
        ? "danger"
        : "warning";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-black text-slate-950">
            {receipt.receipt_code}
          </div>
          <div className="mt-1 text-slate-500">
            {receipt.package_label || "Shipping mark inconnu"}
          </div>
        </div>
        <StatusPill label={condition} tone={tone} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Info icon={<Boxes size={15} />} label="Supplier" value={receipt.supplier_name || "-"} />
        <Info icon={<Scale size={15} />} label="Weight" value={`${receipt.measured_weight_kg || "-"} kg`} />
        <Info icon={<Camera size={15} />} label="Media" value="Ready for proof" />
        <Info icon={<ClipboardCheck size={15} />} label="Received by" value={receipt.received_by_name || "-"} />
      </div>

      {receipt.notes && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-slate-600">
          {receipt.notes}
        </div>
      )}
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="slaivo-card rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
          {icon}
        </span>
        <StatusPill label={tone.toUpperCase()} tone={tone} />
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-bold text-slate-800">{value}</div>
    </div>
  );
}

function Step({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {label}
    </div>
  );
}
