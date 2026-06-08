"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
  UserCheck,
} from "lucide-react";

import {
  completeDeliveryJob,
  getDeliveryJobs,
} from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  RefreshButton,
  StatusPill,
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
  pickup_location?: string | null;
  delivery_address?: string | null;
  payment_status?: string | null;
  release_allowed?: boolean | null;
  created_at: string;
};

const statusOptions = [
  "ALL",
  "PENDING",
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
];

export default function DeliveryJobsPage() {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
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

  async function complete(job: DeliveryJob) {
    setSavingJobId(job.id);
    setError("");

    try {
      await completeDeliveryJob(job.id, {
        recipient_name: job.recipient_name,
        recipient_phone: job.recipient_phone,
      });
      await load();
    } catch {
      setError("Impossible de completer cette livraison. Verifiez paiement/proof.");
    } finally {
      setSavingJobId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return jobs.filter((job) => {
      if (statusFilter !== "ALL" && job.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        job.tracking_id,
        job.recipient_name,
        job.recipient_phone,
        job.assigned_manager_name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedQuery)
        );
    });
  }, [jobs, query, statusFilter]);

  const metrics = useMemo(() => {
    const completed = jobs.filter((job) => job.status === "COMPLETED").length;
    const blocked = jobs.filter((job) => job.status === "BLOCKED" || job.release_allowed === false).length;
    const pending = jobs.filter((job) => !["COMPLETED", "CANCELLED"].includes(job.status)).length;
    const delivery = jobs.filter((job) => job.job_type === "DELIVERY").length;

    return {
      total: jobs.length,
      pending,
      completed,
      blocked,
      delivery,
    };
  }, [jobs]);

  return (
    <CargoPageShell
      eyebrow="Last Mile"
      title="Pickup & Delivery Jobs"
      description="Suivez les retraits bureau, livraisons finales, responsables, blocages paiement et preuves de remise."
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-5">
        <Metric icon={<Truck size={18} />} label="Jobs" value={String(metrics.total)} hint="Total" tone="info" />
        <Metric icon={<Clock size={18} />} label="Pending" value={String(metrics.pending)} hint="A traiter" tone="warning" />
        <Metric icon={<CheckCircle2 size={18} />} label="Completed" value={String(metrics.completed)} hint="Livres" tone="success" />
        <Metric icon={<ShieldAlert size={18} />} label="Blocked" value={String(metrics.blocked)} hint="Paiement/proof" tone={metrics.blocked ? "danger" : "success"} />
        <Metric icon={<MapPin size={18} />} label="Delivery" value={String(metrics.delivery)} hint="Domicile" tone="neutral" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <CargoCard>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <PackageCheck size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Release Control
              </h2>
              <p className="text-sm text-slate-500">
                Filtrer et verifier les jobs.
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
                placeholder="Tracking, client, phone..."
                className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-black text-slate-950">Release checklist</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <Checklist label="Client identity verified" />
                <Checklist label="Balance paid or cleared" />
                <Checklist label="Proof of delivery ready" />
                <Checklist label="Package count confirmed" />
              </div>
            </div>
          </div>
        </CargoCard>

        <CargoCard>
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Delivery Queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredJobs.length} job(s) affiche(s)
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

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {loading && <EmptyState label="Chargement..." />}
            {!loading && filteredJobs.length === 0 && (
              <EmptyState label="Aucun job pour ce filtre." />
            )}
            {filteredJobs.map((job) => (
              <DeliveryCard
                key={job.id}
                job={job}
                saving={savingJobId === job.id}
                onComplete={complete}
              />
            ))}
          </div>
        </CargoCard>
      </section>
    </CargoPageShell>
  );
}

function DeliveryCard({
  job,
  saving,
  onComplete,
}: {
  job: DeliveryJob;
  saving: boolean;
  onComplete: (job: DeliveryJob) => void;
}) {
  const complete = job.status === "COMPLETED";
  const blocked = job.status === "BLOCKED" || job.release_allowed === false;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-black text-slate-950">
            {job.tracking_id || job.job_type}
          </div>
          <div className="mt-1 text-slate-500">{job.job_type}</div>
        </div>
        <StatusPill
          label={job.status}
          tone={complete ? "success" : blocked ? "danger" : "info"}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Info icon={<UserCheck size={15} />} label="Recipient" value={job.recipient_name || "-"} />
        <Info icon={<Phone size={15} />} label="Phone" value={job.recipient_phone || "-"} />
        <Info icon={<MapPin size={15} />} label="Location" value={job.pickup_location || job.delivery_address || "-"} />
        <Info icon={<ShieldAlert size={15} />} label="Release" value={blocked ? "Blocked" : "Allowed"} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-400">
          Responsable : {job.assigned_manager_name || "-"}
        </div>
        {!complete && (
          <button
            onClick={() => onComplete(job)}
            disabled={saving || blocked}
            className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "..." : blocked ? "Blocked" : "Complete"}
          </button>
        )}
      </div>
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

function Checklist({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Search size={13} className="text-emerald-500" />
      {label}
    </div>
  );
}
