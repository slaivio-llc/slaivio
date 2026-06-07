"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, UserRound } from "lucide-react";

import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  MetricCard,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";
import {
  getEscalations,
  updateEscalation,
} from "@/services/escalations";
import type { Escalation } from "@/types/escalations";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED"];

function statusTone(status: string) {
  if (status === "RESOLVED") return "success";
  if (status === "IN_PROGRESS") return "info";
  return "warning";
}

function priorityTone(priority: string) {
  if (priority === "URGENT" || priority === "HIGH") return "danger";
  if (priority === "NORMAL") return "info";
  return "neutral";
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selected, setSelected] = useState<Escalation | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getEscalations();
      setEscalations(data);

      if (selected) {
        setSelected(data.find((item) => item.id === selected.id) || null);
      }
    } catch {
      setError("Impossible de charger les escalations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const open = escalations.filter((item) => item.status === "OPEN").length;
    const active = escalations.filter(
      (item) => item.status === "IN_PROGRESS"
    ).length;
    const urgent = escalations.filter(
      (item) => item.priority === "URGENT" || item.priority === "HIGH"
    ).length;

    return { open, active, urgent };
  }, [escalations]);

  async function changeStatus(status: string) {
    if (!selected) return;

    try {
      const updated = await updateEscalation(selected.id, {
        status,
        resolution_note:
          status === "RESOLVED"
            ? resolutionNote || "Résolu depuis le dashboard"
            : undefined,
      });

      setSelected(updated);
      setResolutionNote("");
      await load();
    } catch {
      setError("Impossible de mettre à jour l'escalation.");
    }
  }

  return (
    <CargoPageShell
      eyebrow="Human Operations"
      title="Escalations"
      description="Surveillez les cas sensibles, priorisez les clients à risque et documentez chaque résolution humaine."
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Ouvertes" value={String(metrics.open)} hint="Cas en attente de traitement" />
        <MetricCard label="En cours" value={String(metrics.active)} hint="Cas pris en charge par l'équipe" />
        <MetricCard label="Prioritaires" value={String(metrics.urgent)} hint="Urgent ou haute priorité" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <CargoCard>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">File escalations</h2>
              <p className="mt-1 text-sm text-slate-500">Clients nécessitant une intervention humaine.</p>
            </div>
            <AlertTriangle className="text-amber-500" size={22} />
          </div>

          <div className="mt-5 space-y-3">
            {loading && <EmptyState label="Chargement des escalations..." />}
            {!loading && escalations.length === 0 && (
              <EmptyState label="Aucune escalation pour le moment." />
            )}

            {escalations.map((escalation) => (
              <button
                key={escalation.id}
                onClick={() => setSelected(escalation)}
                className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                  selected?.id === escalation.id
                    ? "border-sky-200 bg-sky-50 shadow-md"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-950">
                      {escalation.client_phone || "Client inconnu"}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {escalation.reason}
                    </p>
                  </div>
                  <StatusPill label={escalation.priority} tone={priorityTone(escalation.priority)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill label={escalation.status} tone={statusTone(escalation.status)} />
                  {escalation.case_type && <StatusPill label={escalation.case_type} />}
                </div>
              </button>
            ))}
          </div>
        </CargoCard>

        <CargoCard>
          {!selected && (
            <div className="flex min-h-[520px] items-center justify-center">
              <EmptyState label="Sélectionnez une escalation pour voir le détail opérationnel." />
            </div>
          )}

          {selected && (
            <div>
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={selected.status} tone={statusTone(selected.status)} />
                    <StatusPill label={selected.priority} tone={priorityTone(selected.priority)} />
                  </div>
                  <h2 className="mt-4 text-3xl font-black text-slate-950">
                    {selected.client_phone || "Client inconnu"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {selected.client_name || "Nom non renseigné"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Créé le{" "}
                  <span className="font-bold text-slate-950">
                    {new Date(selected.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <InfoCard icon={<UserRound size={17} />} label="Assigné à" value={selected.assigned_to || "-"} />
                <InfoCard icon={<AlertTriangle size={17} />} label="Type" value={selected.case_type || "-"} />
                <InfoCard icon={<Clock size={17} />} label="Dossier" value={selected.dossier_status || "-"} />
                <InfoCard icon={<CheckCircle2 size={17} />} label="Résolu" value={selected.resolved_at ? "Oui" : "Non"} />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-black text-slate-950">Raison</h3>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {selected.reason}
                  </p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-black text-slate-950">Traitement</h3>

                  <div className="mt-5 space-y-4">
                    <select
                      value={selected.status}
                      onChange={(event) => changeStatus(event.target.value)}
                      className="slaivo-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>

                    <textarea
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      placeholder="Note de résolution..."
                      className="slaivo-focus min-h-[150px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    />

                    <button
                      onClick={() => changeStatus("RESOLVED")}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5"
                    >
                      Marquer résolu
                    </button>

                    {selected.resolution_note && (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                        <div className="font-bold text-slate-950">Note existante</div>
                        <p className="mt-2">{selected.resolution_note}</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </CargoCard>
      </section>
    </CargoPageShell>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-lg font-black text-slate-950">{value}</div>
    </div>
  );
}
