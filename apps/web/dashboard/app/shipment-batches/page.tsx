"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CalendarClock,
  Container,
  Plane,
  Plus,
  RefreshCw,
  Route,
  Ship,
  Truck,
} from "lucide-react";

import {
  createBatchManifest,
  createShipmentBatch,
  getShipmentBatches,
  updateShipmentBatchStatus,
} from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";

type Batch = {
  id: string;
  batch_code: string;
  batch_type: string;
  status: string;
  route_origin_country?: string | null;
  route_origin_city?: string | null;
  route_destination_country?: string | null;
  route_destination_city?: string | null;
  carrier_name?: string | null;
  carrier_reference?: string | null;
  eta_at?: string | null;
  manifest_status?: string | null;
  created_at: string;
};

const statusColumns = [
  "DRAFT",
  "READY",
  "DISPATCHED",
  "ARRIVED",
  "CLOSED",
];

export default function ShipmentBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchType, setBatchType] = useState("AIR");
  const [originCity, setOriginCity] = useState("Guangzhou");
  const [destinationCity, setDestinationCity] = useState("Kinshasa");
  const [carrierName, setCarrierName] = useState("");
  const [etaAt, setEtaAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setBatches(await getShipmentBatches());
    } catch {
      setError("Impossible de charger les batches.");
    } finally {
      setLoading(false);
    }
  }

  async function createBatch() {
    setSaving(true);
    setError("");

    try {
      await createShipmentBatch({
        batch_type: batchType,
        route_origin_city: originCity,
        route_destination_city: destinationCity,
        carrier_name: carrierName || null,
        eta_at: etaAt || null,
      });
      setCarrierName("");
      setEtaAt("");
      await load();
    } catch {
      setError("Impossible de creer le batch.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(batchId: string, status: string) {
    setError("");

    try {
      await updateShipmentBatchStatus(batchId, status);
      await load();
    } catch {
      setError("Impossible de changer le statut du batch.");
    }
  }

  async function generateManifest(batchId: string) {
    setError("");

    try {
      await createBatchManifest(batchId);
      await load();
    } catch {
      setError("Impossible de generer le manifest.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const dispatched = batches.filter((batch) =>
      ["DISPATCHED", "IN_TRANSIT"].includes(batch.status)
    ).length;
    const arrived = batches.filter((batch) =>
      ["ARRIVED", "CLOSED"].includes(batch.status)
    ).length;
    const needsManifest = batches.filter(
      (batch) => batch.manifest_status !== "GENERATED"
    ).length;

    return {
      total: batches.length,
      dispatched,
      arrived,
      needsManifest,
    };
  }, [batches]);

  return (
    <CargoPageShell
      eyebrow="Consolidation"
      title="Shipment Batches"
      description="Regroupez les colis, preparez les manifests, suivez les departs et les arrivees par route cargo."
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={<Boxes size={18} />} label="Batches" value={String(metrics.total)} hint="Lots crees" />
        <Metric icon={<Plane size={18} />} label="Departed" value={String(metrics.dispatched)} hint="En transit" />
        <Metric icon={<Container size={18} />} label="Arrived" value={String(metrics.arrived)} hint="Arrives destination" />
        <Metric icon={<CalendarClock size={18} />} label="Manifest" value={String(metrics.needsManifest)} hint="A generer/verifier" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <CargoCard>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Plus size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Create batch
              </h2>
              <p className="text-sm text-slate-500">
                Lot air, sea, road ou express.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <select
              value={batchType}
              onChange={(event) => setBatchType(event.target.value)}
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="AIR">AIR</option>
              <option value="SEA">SEA</option>
              <option value="ROAD">ROAD</option>
              <option value="EXPRESS">EXPRESS</option>
            </select>
            <input
              value={originCity}
              onChange={(event) => setOriginCity(event.target.value)}
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Ville origine"
            />
            <input
              value={destinationCity}
              onChange={(event) => setDestinationCity(event.target.value)}
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Ville destination"
            />
            <input
              value={carrierName}
              onChange={(event) => setCarrierName(event.target.value)}
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Transporteur"
            />
            <input
              value={etaAt}
              onChange={(event) => setEtaAt(event.target.value)}
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="ETA ISO optionnel"
            />
            <button
              onClick={createBatch}
              disabled={saving}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving ? "Creation..." : "Creer batch"}
            </button>
          </div>
        </CargoCard>

        <div className="grid gap-4 xl:grid-cols-5">
          {statusColumns.map((status) => {
            const columnBatches = batches.filter((batch) => {
              if (status === "READY") {
                return ["READY", "READY_FOR_DISPATCH"].includes(batch.status);
              }
              if (status === "DISPATCHED") {
                return ["DISPATCHED", "IN_TRANSIT"].includes(batch.status);
              }
              return batch.status === status;
            });

            return (
              <section
                key={status}
                className="slaivo-card min-h-[520px] rounded-[1.75rem] p-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    {status}
                  </h2>
                  <StatusPill label={String(columnBatches.length)} tone="neutral" />
                </div>

                <div className="mt-4 space-y-3">
                  {loading && status === "DRAFT" && <EmptyState label="Chargement..." />}
                  {!loading && columnBatches.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                      Aucun batch.
                    </div>
                  )}
                  {columnBatches.map((batch) => (
                    <BatchCard
                      key={batch.id}
                      batch={batch}
                      onStatus={changeStatus}
                      onManifest={generateManifest}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </CargoPageShell>
  );
}

function BatchCard({
  batch,
  onStatus,
  onManifest,
}: {
  batch: Batch;
  onStatus: (batchId: string, status: string) => void;
  onManifest: (batchId: string) => void;
}) {
  const Icon =
    batch.batch_type === "SEA"
      ? Ship
      : batch.batch_type === "ROAD"
        ? Truck
        : Plane;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <Icon size={18} />
        </span>
        <StatusPill label={batch.batch_type} tone="info" />
      </div>
      <div className="mt-4 font-black text-slate-950">{batch.batch_code}</div>
      <div className="mt-2 flex items-center gap-2 text-slate-500">
        <Route size={14} />
        <span className="truncate">
          {batch.route_origin_city || "-"} → {batch.route_destination_city || "-"}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        {batch.carrier_name || "Transporteur non defini"}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {batch.status === "DRAFT" && (
          <button onClick={() => onStatus(batch.id, "READY")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
            Ready
          </button>
        )}
        {["READY", "READY_FOR_DISPATCH"].includes(batch.status) && (
          <button onClick={() => onStatus(batch.id, "DISPATCHED")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
            Dispatch
          </button>
        )}
        {["DISPATCHED", "IN_TRANSIT"].includes(batch.status) && (
          <button onClick={() => onStatus(batch.id, "ARRIVED")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
            Arrived
          </button>
        )}
        <button onClick={() => onManifest(batch.id)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
          Manifest
        </button>
      </div>
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="slaivo-card rounded-3xl p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
        {icon}
      </span>
      <div className="mt-4 text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
