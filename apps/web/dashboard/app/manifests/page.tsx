"use client";

import { useEffect, useState } from "react";

import { getManifests } from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";

type Manifest = {
  id: string;
  manifest_code: string;
  status: string;
  total_shipments: number;
  total_weight_kg: number | null;
  total_volume_cbm: number | null;
  generated_by_name: string | null;
  created_at: string;
};

export default function ManifestsPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setManifests(await getManifests());
    } catch {
      setError("Impossible de charger les manifests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <CargoPageShell
      title="Manifests"
      description="Documents batch, manifest cargo et synthèse des colis."
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <CargoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Manifests</h2>
          <RefreshButton onClick={load} />
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && manifests.length === 0 && (
            <EmptyState label="Aucun manifest pour le moment." />
          )}
          {manifests.map((manifest) => (
            <div
              key={manifest.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-950">
                  {manifest.manifest_code}
                </div>
                <StatusPill label={manifest.status} tone="success" />
              </div>
              <div className="mt-2 text-slate-500">
                {manifest.total_shipments} colis • {manifest.total_weight_kg || 0} kg
              </div>
              <div className="mt-2 text-xs font-medium text-slate-400">
                Généré par {manifest.generated_by_name || "-"}
              </div>
            </div>
          ))}
        </div>
      </CargoCard>
    </CargoPageShell>
  );
}
