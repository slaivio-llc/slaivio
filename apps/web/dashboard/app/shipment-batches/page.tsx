"use client";

import { useEffect, useState } from "react";

import {
  createShipmentBatch,
  getShipmentBatches,
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
  route_origin_city?: string | null;
  route_destination_city?: string | null;
  carrier_name?: string | null;
  eta_at?: string | null;
  created_at: string;
};

export default function ShipmentBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchType, setBatchType] = useState("AIR");
  const [originCity, setOriginCity] = useState("Guangzhou");
  const [destinationCity, setDestinationCity] = useState("Kinshasa");
  const [carrierName, setCarrierName] = useState("");
  const [loading, setLoading] = useState(true);
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
    setError("");

    try {
      await createShipmentBatch({
        batch_type: batchType,
        route_origin_city: originCity,
        route_destination_city: destinationCity,
        carrier_name: carrierName || null,
      });
      await load();
    } catch {
      setError("Impossible de créer le batch.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <CargoPageShell
      title="Shipment Batches"
      description="Groupage, containers et lots d’expédition cargo."
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <CargoCard>
        <h2 className="text-lg font-black text-slate-950">Créer un batch</h2>
        <p className="mt-1 text-sm text-slate-500">
          Préparez un lot air, maritime, route ou groupage.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            value={batchType}
            onChange={(event) => setBatchType(event.target.value)}
            className="slaivo-focus rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="AIR, SEA, ROAD..."
          />
          <input
            value={originCity}
            onChange={(event) => setOriginCity(event.target.value)}
            className="slaivo-focus rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Ville origine"
          />
          <input
            value={destinationCity}
            onChange={(event) => setDestinationCity(event.target.value)}
            className="slaivo-focus rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Ville destination"
          />
          <input
            value={carrierName}
            onChange={(event) => setCarrierName(event.target.value)}
            className="slaivo-focus rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Transporteur"
          />
          <button
            onClick={createBatch}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          >
            Créer
          </button>
        </div>
      </CargoCard>

      <CargoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Batches</h2>
          <RefreshButton onClick={load} />
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && batches.length === 0 && (
            <EmptyState label="Aucun batch pour le moment." />
          )}
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-950">{batch.batch_code}</div>
                <StatusPill label={batch.status} tone="info" />
              </div>
              <div className="mt-2 text-slate-500">
                {batch.batch_type} • {batch.route_origin_city || "-"} →{" "}
                {batch.route_destination_city || "-"}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-400">
                {batch.carrier_name || "Transporteur non défini"}
              </div>
            </div>
          ))}
        </div>
      </CargoCard>
    </CargoPageShell>
  );
}
