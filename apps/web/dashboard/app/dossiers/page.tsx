"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

import {
  getDossiers,
  getDossier,
} from "@/services/dossiers";

import type {
  Dossier,
  DossierDetails,
} from "@/types/dossiers";


export default function DossiersPage() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [selected, setSelected] =
    useState<DossierDetails | null>(null);

  const [loading, setLoading] = useState(true);


  useEffect(() => {
    getDossiers()
      .then(setDossiers)
      .finally(() => setLoading(false));
  }, []);


  async function openDossier(
    dossierId: string
  ) {
    const details = await getDossier(
      dossierId
    );

    setSelected(details);
  }


  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-[420px] border-r">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">
              Dossiers
            </h1>

            <p className="text-sm text-muted-foreground">
              Gestion opérationnelle cargo
            </p>
          </div>

          <div className="divide-y overflow-auto">
            {loading && (
              <div className="p-6">
                Chargement...
              </div>
            )}

            {dossiers.map((dossier) => (
              <button
                key={dossier.id}
                onClick={() =>
                  openDossier(dossier.id)
                }
                className="
                  w-full text-left p-5
                  hover:bg-muted transition
                "
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {dossier.client_phone}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {dossier.case_type}
                  </div>
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  {dossier.client_name || "Client inconnu"}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {dossier.status_global}
                  </span>

                  <span className="rounded-full border px-2 py-1 text-xs">
                    {dossier.intake_status}
                  </span>

                  <span className="rounded-full border px-2 py-1 text-xs">
                    {dossier.validation_status}
                  </span>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  {dossier.message_count} message(s)
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex-1 overflow-auto">
          {!selected && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Sélectionnez un dossier
            </div>
          )}

          {selected && (
            <div>
              <div className="border-b p-8">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold">
                    {selected.dossier.client_phone}
                  </h2>

                  <span className="rounded-full border px-3 py-1 text-xs">
                    {selected.dossier.status_global}
                  </span>
                </div>

                <div className="mt-3 text-muted-foreground">
                  {selected.dossier.client_name || "Client inconnu"}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-muted-foreground">
                      Validation
                    </div>

                    <div className="mt-2 text-lg font-semibold">
                      {selected.dossier.validation_status}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-muted-foreground">
                      Intake
                    </div>

                    <div className="mt-2 text-lg font-semibold">
                      {selected.dossier.intake_status}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-muted-foreground">
                      Channel
                    </div>

                    <div className="mt-2 text-lg font-semibold">
                      {selected.dossier.primary_channel}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h3 className="text-xl font-bold">
                  Timeline
                </h3>

                <div className="mt-6 space-y-4">
                  {selected.timeline.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border p-5"
                    >
                      <div className="font-semibold">
                        {event.event_type}
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(
                          event.created_at
                        ).toLocaleString()}
                      </div>

                      <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-xs">
                        {JSON.stringify(
                          event.event_payload,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
