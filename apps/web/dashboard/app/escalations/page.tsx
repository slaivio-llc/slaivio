"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

import {
  getEscalations,
  updateEscalation,
} from "@/services/escalations";

import type { Escalation } from "@/types/escalations";

const STATUS_OPTIONS = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
];

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selected, setSelected] = useState<Escalation | null>(null);

  const [resolutionNote, setResolutionNote] = useState("");

  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await getEscalations();

    setEscalations(data);

    setLoading(false);

    if (selected) {
      const refreshed = data.find(
        (item) => item.id === selected.id
      );

      setSelected(refreshed || null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(status: string) {
    if (!selected) return;

    const updated = await updateEscalation(
      selected.id,
      {
        status,
        resolution_note:
          status === "RESOLVED"
            ? resolutionNote ||
              "Résolu depuis le dashboard"
            : undefined,
      }
    );

    setSelected(updated);

    setResolutionNote("");

    await load();
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-[440px] border-r">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">
              Escalations
            </h1>

            <p className="text-sm text-muted-foreground">
              Cas nécessitant une intervention humaine
            </p>
          </div>

          <div className="divide-y overflow-auto">
            {loading && (
              <div className="p-6 text-muted-foreground">
                Chargement...
              </div>
            )}

            {!loading &&
              escalations.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  Aucune escalation pour le moment.
                </div>
              )}

            {escalations.map((escalation) => (
              <button
                key={escalation.id}
                onClick={() =>
                  setSelected(escalation)
                }
                className="w-full p-5 text-left transition hover:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {escalation.client_phone ||
                      "Client inconnu"}
                  </div>

                  <span className="rounded-full border px-2 py-1 text-xs">
                    {escalation.priority}
                  </span>
                </div>

                <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {escalation.reason}
                </div>

                <div className="mt-4 flex gap-2">
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {escalation.status}
                  </span>

                  {escalation.case_type && (
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {escalation.case_type}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex-1 overflow-auto">
          {!selected && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Sélectionnez une escalation
            </div>
          )}

          {selected && (
            <div>
              <div className="border-b p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold">
                      {selected.client_phone ||
                        "Client inconnu"}
                    </h2>

                    <p className="mt-2 text-muted-foreground">
                      {selected.client_name ||
                        "Nom non renseigné"}
                    </p>
                  </div>

                  <span className="rounded-full border px-4 py-2 text-sm">
                    {selected.status}
                  </span>
                </div>

                <div className="mt-8 grid grid-cols-4 gap-4">
                  <InfoCard
                    label="Priorité"
                    value={selected.priority}
                  />

                  <InfoCard
                    label="Dossier"
                    value={
                      selected.case_type || "-"
                    }
                  />

                  <InfoCard
                    label="Status dossier"
                    value={
                      selected.dossier_status ||
                      "-"
                    }
                  />

                  <InfoCard
                    label="Créé le"
                    value={new Date(
                      selected.created_at
                    ).toLocaleDateString()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 p-8">
                <section className="rounded-2xl border p-6">
                  <h3 className="text-xl font-bold">
                    Raison
                  </h3>

                  <p className="mt-4 whitespace-pre-wrap text-sm">
                    {selected.reason}
                  </p>
                </section>

                <section className="rounded-2xl border p-6">
                  <h3 className="text-xl font-bold">
                    Traitement
                  </h3>

                  <div className="mt-5 space-y-4">
                    <select
                      value={selected.status}
                      onChange={(event) =>
                        changeStatus(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                    >
                      {STATUS_OPTIONS.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        )
                      )}
                    </select>

                    <textarea
                      value={resolutionNote}
                      onChange={(event) =>
                        setResolutionNote(
                          event.target.value
                        )
                      }
                      placeholder="Note de résolution..."
                      className="min-h-[160px] w-full rounded-xl border px-4 py-3"
                    />

                    <button
                      onClick={() =>
                        changeStatus("RESOLVED")
                      }
                      className="rounded-xl bg-black px-5 py-3 text-white"
                    >
                      Marquer résolu
                    </button>

                    {selected.resolution_note && (
                      <div className="rounded-xl bg-muted p-4 text-sm">
                        <div className="font-semibold">
                          Note existante
                        </div>

                        <p className="mt-2">
                          {
                            selected.resolution_note
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs text-muted-foreground">
        {label}
      </div>

      <div className="mt-2 text-lg font-semibold">
        {value}
      </div>
    </div>
  );
}