"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Package,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import type {
  Shipment,
  ShipmentDetails,
  ShipmentTimelineEvent,
} from "@/types/shipments";
import {
  getShipment,
  getShipments,
  updateShipmentStatus,
} from "@/services/shipments";

const STATUS_OPTIONS = [
  "DRAFT",
  "PENDING_DEPOSIT",
  "DEPOSIT_CONFIRMED",
  "WAITING_SUPPLIER",
  "RECEIVED_AT_ORIGIN",
  "WAREHOUSE_PROCESSING",
  "READY_FOR_DISPATCH",
  "IN_TRANSIT",
  "CUSTOMS",
  "ARRIVED_DESTINATION",
  "READY_PICKUP",
  "DELIVERED",
  "CANCELLED",
  "LOST",
  "RETURNED",
];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected, setSelected] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const active = shipments.filter((shipment) => {
      const status = shipment.current_status || shipment.status;
      return !["DELIVERED", "CANCELLED", "LOST", "RETURNED"].includes(status);
    }).length;
    const inTransit = shipments.filter(
      (shipment) => (shipment.current_status || shipment.status) === "IN_TRANSIT"
    ).length;
    const customs = shipments.filter(
      (shipment) => shipment.customs_status && shipment.customs_status !== "NOT_REQUIRED"
    ).length;
    const delayed = shipments.filter(
      (shipment) => shipment.delay_status && shipment.delay_status !== "ON_TIME"
    ).length;

    return {
      total: shipments.length,
      active,
      inTransit,
      customs,
      delayed,
    };
  }, [shipments]);

  async function loadShipments() {
    setLoading(true);
    setError("");

    try {
      const list = await getShipments();
      setShipments(list);
      if (!selected && list[0]) {
        const details = await getShipment(list[0].id);
        setSelected(details);
      }
    } catch {
      setError("Impossible de charger les shipments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShipments();
  }, []);

  async function openShipment(shipmentId: string) {
    setError("");

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
      setShipments(await getShipments());
    } catch {
      setError("Impossible de modifier le statut.");
    }
  }

  return (
    <DashboardLayout>
      <main className="p-4 md:p-8">
        <section className="slaivo-gradient-card rounded-[2rem] p-6 text-white md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
                <Truck size={14} />
                Shipment Lifecycle
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Shipments Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Suivez les colis de la demande client au warehouse, transit,
                douane, arrivée, pickup et livraison finale.
              </p>
            </div>

            <button
              onClick={loadShipments}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-xl transition hover:-translate-y-0.5"
            >
              Rafraîchir les shipments
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Total" value={String(stats.total)} hint="Shipments créés" />
          <Metric label="Actifs" value={String(stats.active)} hint="Encore en opération" />
          <Metric label="Transit" value={String(stats.inTransit)} hint="Sur route ou avion" />
          <Metric label="Alertes" value={String(stats.customs + stats.delayed)} hint="Douane ou retard" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="slaivo-card max-h-[calc(100vh-260px)] overflow-hidden rounded-[2rem]">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-black text-slate-950">
                Liste des shipments
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Sélectionnez un tracking pour voir le détail.
              </p>
            </div>

            <div className="max-h-[calc(100vh-360px)] overflow-auto p-3">
              {loading && (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Chargement...
                </div>
              )}

              {!loading && shipments.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Aucun shipment pour le moment.
                </div>
              )}

              <div className="space-y-2">
                {shipments.map((shipment) => {
                  const currentStatus = shipment.current_status || shipment.status;
                  const isSelected = selected?.shipment.id === shipment.id;

                  return (
                    <button
                      key={shipment.id}
                      onClick={() => openShipment(shipment.id)}
                      className={`w-full rounded-3xl border p-4 text-left transition ${
                        isSelected
                          ? "border-sky-200 bg-sky-50 shadow-sm"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-950">
                            {shipment.tracking_id || "Sans tracking"}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {shipment.client_phone || "Client inconnu"}
                          </div>
                        </div>
                        <StatusBadge status={currentStatus} />
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={15} className="text-slate-400" />
                        <span className="truncate">
                          {shipment.origin_city ||
                            shipment.origin_country ||
                            "Origine ?"}
                        </span>
                        <ArrowRight size={14} className="text-slate-300" />
                        <span className="truncate">
                          {shipment.destination_city ||
                            shipment.destination_country ||
                            "Destination ?"}
                        </span>
                      </div>

                      <div className="mt-3 text-xs font-medium text-slate-400">
                        {shipment.goods_type || "Marchandise non précisée"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-[620px]">
            {!selected && (
              <div className="slaivo-card flex h-full items-center justify-center rounded-[2rem] p-8 text-center">
                <div>
                  <Package className="mx-auto text-slate-300" size={44} />
                  <div className="mt-4 text-lg font-bold text-slate-950">
                    Sélectionnez un shipment
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Les détails lifecycle apparaîtront ici.
                  </div>
                </div>
              </div>
            )}

            {selected && (
              <ShipmentDetail
                selected={selected}
                onChangeStatus={changeStatus}
              />
            )}
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}

function ShipmentDetail({
  selected,
  onChangeStatus,
}: {
  selected: ShipmentDetails;
  onChangeStatus: (status: string) => void;
}) {
  const shipment = selected.shipment;
  const currentStatus = shipment.current_status || shipment.status;

  return (
    <div className="space-y-6">
      <div className="slaivo-card rounded-[2rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusBadge status={currentStatus} />
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              {shipment.tracking_id || "Sans tracking"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {shipment.client_name || "Client"} •{" "}
              {shipment.client_phone || "Téléphone inconnu"}
            </p>
          </div>

          <select
            value={currentStatus}
            onChange={(event) => onChangeStatus(event.target.value)}
            className="slaivo-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <InfoCard
            icon={<MapPin size={18} />}
            label="Origine"
            value={shipment.origin_city || shipment.origin_country || "-"}
          />
          <InfoCard
            icon={<Route size={18} />}
            label="Destination"
            value={
              shipment.destination_city ||
              shipment.destination_country ||
              "-"
            }
          />
          <InfoCard
            icon={<CalendarClock size={18} />}
            label="ETA"
            value={
              shipment.eta_at
                ? new Date(shipment.eta_at).toLocaleDateString()
                : "-"
            }
          />
          <InfoCard
            icon={<ShieldCheck size={18} />}
            label="Douane"
            value={shipment.customs_status || "-"}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <InfoCard
            icon={<Package size={18} />}
            label="Warehouse"
            value={shipment.inventory_status || shipment.batch_status || "-"}
          />
          <InfoCard
            icon={<Truck size={18} />}
            label="Delivery"
            value={shipment.delivery_status || "-"}
          />
          <InfoCard
            icon={<CheckCircle2 size={18} />}
            label="Release"
            value={shipment.final_release_status || "-"}
          />
          <InfoCard
            icon={<AlertTriangle size={18} />}
            label="Délai"
            value={shipment.delay_status || "ON_TIME"}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Timeline opérationnelle">
          <div className="space-y-4">
            {selected.timeline.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Aucun événement pour le moment.
              </div>
            )}

            {selected.timeline.map((event) => (
              <OperationalEventCard key={event.id} event={event} />
            ))}
          </div>
        </Panel>

        <Panel title="Médias et preuves">
          <div className="space-y-4">
            {selected.media.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Aucun média pour le moment.
              </div>
            )}

            {selected.media.map((media) => (
              <div
                key={media.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="font-bold text-slate-950">
                  {media.media_type || "Média"}
                </div>

                {media.media_url ? (
                  <a
                    href={media.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-sm font-semibold text-sky-600 underline"
                  >
                    Ouvrir média
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Média sans URL publique
                  </p>
                )}

                {media.caption && (
                  <p className="mt-3 text-sm text-slate-500">
                    {media.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="slaivo-card rounded-3xl p-5">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        <span className="text-sky-600">{icon}</span>
        {label}
      </div>
      <div className="mt-3 truncate text-lg font-black text-slate-950">
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="slaivo-card rounded-[2rem] p-6">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OperationalEventCard({
  event,
}: {
  event: ShipmentTimelineEvent;
}) {
  const summary = getEventSummary(event.event_payload);

  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-sky-100" />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-black text-slate-950">
              {formatEventType(event.event_type)}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">
              {new Date(event.created_at).toLocaleString()}
            </div>
          </div>
          <StatusBadge status={event.event_type} />
        </div>

        {summary.description && (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {summary.description}
          </p>
        )}

        {summary.fields.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {summary.fields.map((field) => (
              <div
                key={field.label}
                className="rounded-2xl bg-slate-50 px-3 py-2"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {field.label}
                </div>
                <div className="mt-1 truncate text-sm font-bold text-slate-700">
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const tone = getStatusTone(status);

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${tone}`}
    >
      {status}
    </span>
  );
}

function getStatusTone(status: string) {
  if (["DELIVERED", "READY_PICKUP", "ARRIVED_DESTINATION"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["IN_TRANSIT", "CUSTOMS", "WAREHOUSE_PROCESSING"].includes(status)) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (["LOST", "CANCELLED", "RETURNED"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) =>
    char.toUpperCase()
  );
}

function getEventSummary(payload: unknown): {
  description: string;
  fields: Array<{ label: string; value: string }>;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      description: payload ? String(payload) : "",
      fields: [],
    };
  }

  const data = payload as Record<string, unknown>;
  const description =
    stringValue(data.message) ||
    stringValue(data.event_message) ||
    stringValue(data.notes) ||
    stringValue(data.reason) ||
    stringValue(data.status) ||
    "";

  const ignoredKeys = new Set([
    "message",
    "event_message",
    "notes",
    "raw_payload",
    "metadata",
  ]);

  const fields = Object.entries(data)
    .filter(([key, value]) => !ignoredKeys.has(key) && value !== null && value !== undefined)
    .slice(0, 6)
    .map(([key, value]) => ({
      label: key.replaceAll("_", " "),
      value: compactValue(value),
    }));

  return {
    description,
    fields,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function compactValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toLocaleString();
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === "object" && value) return "Données enregistrées";
  return "-";
}
