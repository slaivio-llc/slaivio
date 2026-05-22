"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

import {
  getShipment,
  getShipments,
  updateShipmentStatus,
} from "@/services/shipments";

import type {
  Shipment,
  ShipmentDetails,
} from "@/types/shipments";

const STATUS_OPTIONS = [
  "CREATED",
  "RECEIVED_AT_ORIGIN",
  "SCHEDULED_FOR_DEPARTURE",
  "DEPARTED",
  "IN_TRANSIT",
  "ARRIVED_DESTINATION",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "BLOCKED",
  "ISSUE",
];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected, setSelected] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getShipments()
      .then(setShipments)
      .catch(() => {
        setError("Impossible de charger les shipments.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function openShipment(shipmentId: string) {
    try {
      const details = await getShipment(shipmentId);
      setSelected(details);
    } catch {
      setError("Impossible de charger ce shipment.");
    }
  }

  async function changeStatus(status: string) {
    if (!selected) return;

    try {
      await updateShipmentStatus(
        selected.shipment.id,
        status,
        "Updated from dashboard"
      );

      const refreshed = await getShipment(selected.shipment.id);
      setSelected(refreshed);

      const list = await getShipments();
      setShipments(list);
    } catch {
      setError("Impossible de modifier le statut.");
    }
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        <section className="w-[440px] border-r">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">Shipments</h1>

            <p className="text-sm text-gray-500">
              Suivi des colis et expéditions
            </p>
          </div>

          {error && (
            <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="divide-y overflow-auto">
            {loading && (
              <div className="p-6 text-gray-500">
                Chargement...
              </div>
            )}

            {!loading && shipments.length === 0 && (
              <div className="p-6 text-sm text-gray-500">
                Aucun shipment pour le moment.
              </div>
            )}

            {shipments.map((shipment) => (
              <button
                key={shipment.id}
                onClick={() => openShipment(shipment.id)}
                className="w-full p-5 text-left transition hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {shipment.tracking_id || "Sans tracking"}
                  </div>

                  <span className="rounded-full border px-2 py-1 text-xs">
                    {shipment.status}
                  </span>
                </div>

                <div className="mt-2 text-sm text-gray-500">
                  {shipment.client_phone || "Client inconnu"}
                </div>

                <div className="mt-3 text-sm">
                  {shipment.origin_country || "Origine ?"} →{" "}
                  {shipment.destination_city ||
                    shipment.destination_country ||
                    "Destination ?"}
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  {shipment.goods_type || "Marchandise non précisée"}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex-1 overflow-auto">
          {!selected && (
            <div className="flex h-full items-center justify-center text-gray-500">
              Sélectionnez un shipment
            </div>
          )}

          {selected && (
            <div>
              <div className="border-b p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold">
                      {selected.shipment.tracking_id || "Sans tracking"}
                    </h2>

                    <p className="mt-2 text-gray-500">
                      {selected.shipment.client_phone || "Client inconnu"}
                    </p>
                  </div>

                  <select
                    value={selected.shipment.status}
                    onChange={(event) => changeStatus(event.target.value)}
                    className="rounded-xl border px-4 py-3"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-8 grid grid-cols-4 gap-4">
                  <InfoCard
                    label="Origine"
                    value={
                      selected.shipment.origin_city ||
                      selected.shipment.origin_country ||
                      "-"
                    }
                  />

                  <InfoCard
                    label="Destination"
                    value={
                      selected.shipment.destination_city ||
                      selected.shipment.destination_country ||
                      "-"
                    }
                  />

                  <InfoCard
                    label="Poids estimé"
                    value={
                      selected.shipment.estimated_weight_kg
                        ? `${selected.shipment.estimated_weight_kg} kg`
                        : "-"
                    }
                  />

                  <InfoCard
                    label="Prix final"
                    value={
                      selected.shipment.final_total
                        ? `${selected.shipment.final_total} ${
                            selected.shipment.final_currency || ""
                          }`
                        : "-"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 p-8">
                <section>
                  <h3 className="text-xl font-bold">Timeline</h3>

                  <div className="mt-5 space-y-4">
                    {selected.timeline.length === 0 && (
                      <div className="rounded-2xl border p-5 text-sm text-gray-500">
                        Aucun événement pour le moment.
                      </div>
                    )}

                    {selected.timeline.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border p-5"
                      >
                        <div className="font-semibold">
                          {event.event_type}
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          {new Date(event.created_at).toLocaleString()}
                        </div>

                        <pre className="mt-4 overflow-auto rounded-xl bg-gray-50 p-4 text-xs">
                          {JSON.stringify(event.event_payload, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-xl font-bold">Médias</h3>

                  <div className="mt-5 space-y-4">
                    {selected.media.length === 0 && (
                      <div className="rounded-2xl border p-5 text-sm text-gray-500">
                        Aucun média pour le moment.
                      </div>
                    )}

                    {selected.media.map((media) => (
                      <div
                        key={media.id}
                        className="rounded-2xl border p-5"
                      >
                        <div className="font-semibold">
                          {media.media_type || "Média"}
                        </div>

                        {media.media_url ? (
                          <a
                            href={media.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block text-sm text-blue-600 underline"
                          >
                            Ouvrir média
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500">
                            Média sans URL publique
                          </p>
                        )}

                        {media.caption && (
                          <p className="mt-3 text-sm text-gray-500">
                            {media.caption}
                          </p>
                        )}
                      </div>
                    ))}
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
      <div className="text-xs text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-lg font-semibold">
        {value}
      </div>
    </div>
  );
}