"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Boxes,
  FileText,
  PackageCheck,
  Scale,
  Search,
  UserCheck,
} from "lucide-react";

import {
  getManifestItems,
  getManifests,
} from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  MetricCard,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";

type Manifest = {
  id: string;
  manifest_code: string;
  batch_id?: string | null;
  status: string;
  total_shipments: number;
  total_weight_kg: number | null;
  total_volume_cbm: number | null;
  generated_by_name: string | null;
  created_at: string;
};

type ManifestItem = {
  id: string;
  tracking_id: string | null;
  goods_type: string | null;
  weight_kg: number | null;
  volume_cbm: number | null;
  created_at: string;
};

export default function ManifestsPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [items, setItems] = useState<ManifestItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredManifests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return manifests;
    }

    return manifests.filter((manifest) =>
      [
        manifest.manifest_code,
        manifest.status,
        manifest.generated_by_name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [manifests, query]);

  const stats = useMemo(() => {
    const generated = manifests.filter((manifest) =>
      ["GENERATED", "READY", "APPROVED"].includes(manifest.status)
    ).length;
    const totalShipments = manifests.reduce(
      (sum, manifest) => sum + (manifest.total_shipments || 0),
      0
    );
    const totalWeight = manifests.reduce(
      (sum, manifest) => sum + Number(manifest.total_weight_kg || 0),
      0
    );

    return {
      total: manifests.length,
      generated,
      totalShipments,
      totalWeight,
    };
  }, [manifests]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const list = await getManifests();
      setManifests(list);

      if (!selectedManifest && list[0]) {
        await openManifest(list[0]);
      }
    } catch {
      setError("Impossible de charger les manifests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openManifest(manifest: Manifest) {
    setSelectedManifest(manifest);
    setItemsLoading(true);
    setError("");

    try {
      setItems(await getManifestItems(manifest.id));
    } catch {
      setItems([]);
      setError("Impossible de charger les colis du manifest.");
    } finally {
      setItemsLoading(false);
    }
  }

  return (
    <CargoPageShell
      title="Manifest Control"
      description="Contrôlez les documents batch, les colis consolidés et les poids avant dispatch international."
      eyebrow="Cargo Documentation"
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Manifests" value={String(stats.total)} hint="Documents cargo générés" />
        <MetricCard label="Validés" value={String(stats.generated)} hint="Prêts pour opération" />
        <MetricCard label="Colis" value={String(stats.totalShipments)} hint="Articles dans manifest" />
        <MetricCard label="Poids total" value={`${stats.totalWeight.toFixed(1)} kg`} hint="Consolidation cumulée" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[440px_1fr]">
        <CargoCard>
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Manifest queue
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Documents créés depuis les batches.
                </p>
              </div>
              <StatusPill label={`${filteredManifests.length} docs`} tone="info" />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <Search size={17} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher manifest, statut, agent..."
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="mt-5 max-h-[660px] space-y-3 overflow-auto pr-1">
            {loading && <EmptyState label="Chargement des manifests..." />}
            {!loading && filteredManifests.length === 0 && (
              <EmptyState label="Aucun manifest ne correspond au filtre." />
            )}

            {filteredManifests.map((manifest) => {
              const isSelected = selectedManifest?.id === manifest.id;

              return (
                <button
                  key={manifest.id}
                  onClick={() => openManifest(manifest)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    isSelected
                      ? "border-sky-200 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950">
                        {manifest.manifest_code}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-400">
                        {new Date(manifest.created_at).toLocaleString()}
                      </div>
                    </div>
                    <StatusPill
                      label={manifest.status}
                      tone={getManifestTone(manifest.status)}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <MiniStat
                      icon={<Boxes size={15} />}
                      label="Colis"
                      value={String(manifest.total_shipments || 0)}
                    />
                    <MiniStat
                      icon={<Scale size={15} />}
                      label="Poids"
                      value={`${manifest.total_weight_kg || 0} kg`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </CargoCard>

        <CargoCard>
          {!selectedManifest && (
            <div className="flex min-h-[520px] items-center justify-center text-center">
              <div>
                <FileText className="mx-auto text-slate-300" size={46} />
                <div className="mt-4 text-lg font-black text-slate-950">
                  Sélectionnez un manifest
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Les colis inclus et la synthèse documentaire s’afficheront ici.
                </p>
              </div>
            </div>
          )}

          {selectedManifest && (
            <div>
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                    <FileText size={14} />
                    Manifest actif
                  </div>
                  <h2 className="mt-4 text-3xl font-black text-slate-950">
                    {selectedManifest.manifest_code}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Généré par {selectedManifest.generated_by_name || "SLAIVIO"} •{" "}
                    {new Date(selectedManifest.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusPill
                  label={selectedManifest.status}
                  tone={getManifestTone(selectedManifest.status)}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <SummaryCard
                  icon={<PackageCheck size={18} />}
                  label="Shipments"
                  value={String(selectedManifest.total_shipments || 0)}
                />
                <SummaryCard
                  icon={<Scale size={18} />}
                  label="Poids"
                  value={`${selectedManifest.total_weight_kg || 0} kg`}
                />
                <SummaryCard
                  icon={<UserCheck size={18} />}
                  label="Agent"
                  value={selectedManifest.generated_by_name || "-"}
                />
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-950">
                    Colis inclus
                  </h3>
                  <StatusPill label={`${items.length} lignes`} tone="neutral" />
                </div>

                <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  {itemsLoading && (
                    <div className="p-5 text-sm text-slate-500">
                      Chargement des items...
                    </div>
                  )}

                  {!itemsLoading && items.length === 0 && (
                    <div className="p-5 text-sm text-slate-500">
                      Aucun colis listé dans ce manifest.
                    </div>
                  )}

                  {!itemsLoading &&
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 border-b border-slate-100 p-4 text-sm last:border-b-0 md:grid-cols-[1.2fr_1fr_120px_120px]"
                      >
                        <div>
                          <div className="font-black text-slate-950">
                            {item.tracking_id || "Sans tracking"}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-slate-600">
                          {item.goods_type || "Marchandise non précisée"}
                        </div>
                        <div className="font-bold text-slate-700">
                          {item.weight_kg || 0} kg
                        </div>
                        <div className="font-bold text-slate-700">
                          {item.volume_cbm || 0} cbm
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CargoCard>
      </section>
    </CargoPageShell>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-black text-slate-950">{value}</div>
    </div>
  );
}

function SummaryCard({
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
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        <span className="text-sky-600">{icon}</span>
        {label}
      </div>
      <div className="mt-3 truncate text-lg font-black text-slate-950">
        {value}
      </div>
    </div>
  );
}

function getManifestTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (["GENERATED", "READY", "APPROVED"].includes(status)) return "success";
  if (["DRAFT", "PENDING"].includes(status)) return "warning";
  if (["FAILED", "CANCELLED"].includes(status)) return "danger";
  return "neutral";
}
