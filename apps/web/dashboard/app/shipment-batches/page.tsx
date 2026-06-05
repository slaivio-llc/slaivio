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
        <h2 className="text-lg font-semibold">Créer un batch</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            value={batchType}
            onChange={(event) => setBatchType(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm"
            placeholder="AIR, SEA, ROAD..."
          />
          <input
            value={originCity}
            onChange={(event) => setOriginCity(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm"
            placeholder="Ville origine"
          />
          <input
            value={destinationCity}
            onChange={(event) => setDestinationCity(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm"
            placeholder="Ville destination"
          />
          <input
            value={carrierName}
            onChange={(event) => setCarrierName(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm"
            placeholder="Transporteur"
          />
          <button
            onClick={createBatch}
            className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            Créer
          </button>
        </div>
      </CargoCard>

      <CargoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Batches</h2>
          <button
            onClick={load}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Rafraîchir
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && batches.length === 0 && (
            <EmptyState label="Aucun batch pour le moment." />
          )}
          {batches.map((batch) => (
            <div key={batch.id} className="rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{batch.batch_code}</div>
                <span className="rounded-full border px-2 py-1 text-xs">
                  {batch.status}
                </span>
              </div>
              <div className="mt-2 text-gray-500">
                {batch.batch_type} • {batch.route_origin_city || "-"} →{" "}
                {batch.route_destination_city || "-"}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {batch.carrier_name || "Transporteur non défini"}
              </div>
            </div>
          ))}
        </div>
      </CargoCard>
    </CargoPageShell>
  );
}

