"use client";

import { useEffect, useState } from "react";

import { getDeliveryJobs } from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
} from "@/components/cargo/cargo-page-shell";

type DeliveryJob = {
  id: string;
  job_type: string;
  status: string;
  tracking_id?: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  assigned_manager_name: string | null;
  scheduled_at: string | null;
  created_at: string;
};

export default function DeliveryJobsPage() {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      setJobs(await getDeliveryJobs());
    } catch {
      setError("Impossible de charger les jobs livraison.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <CargoPageShell
      title="Delivery Jobs"
      description="Pickup, livraison finale, responsables et preuves."
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <CargoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jobs livraison</h2>
          <button onClick={load} className="rounded-xl border px-4 py-2 text-sm">
            Rafraîchir
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading && <EmptyState label="Chargement..." />}
          {!loading && jobs.length === 0 && (
            <EmptyState label="Aucun job livraison pour le moment." />
          )}
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {job.tracking_id || job.job_type}
                </div>
                <span className="rounded-full border px-2 py-1 text-xs">
                  {job.status}
                </span>
              </div>
              <div className="mt-2 text-gray-500">
                {job.recipient_name || "Destinataire non défini"} •{" "}
                {job.recipient_phone || "-"}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Responsable : {job.assigned_manager_name || "-"}
              </div>
            </div>
          ))}
        </div>
      </CargoCard>
    </CargoPageShell>
  );
}

