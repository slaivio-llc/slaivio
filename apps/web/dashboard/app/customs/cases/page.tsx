"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Filter,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import {
  getCustomsCases,
  resolveCustomsCase,
} from "@/services/cargo-os";
import {
  CargoCard,
  CargoPageShell,
  EmptyState,
  MetricCard,
  RefreshButton,
  StatusPill,
} from "@/components/cargo/cargo-page-shell";

type CustomsCase = {
  id: string;
  case_code: string;
  shipment_id?: string | null;
  batch_id?: string | null;
  customs_status: string;
  risk_level: string;
  country_code?: string | null;
  declared_value?: number | null;
  declared_currency?: string | null;
  goods_description: string | null;
  blocked_reason: string | null;
  opened_by_name: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  created_at: string;
};

const STATUS_FILTERS = ["ALL", "OPEN", "PENDING", "BLOCKED", "RESOLVED"];
const RISK_FILTERS = ["ALL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

export default function CustomsCasesPage() {
  const [cases, setCases] = useState<CustomsCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<CustomsCase | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const statusMatches =
        statusFilter === "ALL" || item.customs_status === statusFilter;
      const riskMatches = riskFilter === "ALL" || item.risk_level === riskFilter;

      return statusMatches && riskMatches;
    });
  }, [cases, riskFilter, statusFilter]);

  const stats = useMemo(() => {
    const open = cases.filter((item) => item.customs_status !== "RESOLVED").length;
    const highRisk = cases.filter((item) => item.risk_level === "HIGH").length;
    const blocked = cases.filter((item) =>
      ["BLOCKED", "OPEN", "PENDING"].includes(item.customs_status)
    ).length;
    const resolved = cases.filter((item) => item.customs_status === "RESOLVED").length;

    return {
      open,
      highRisk,
      blocked,
      resolved,
    };
  }, [cases]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const list = (await getCustomsCases()) as CustomsCase[];
      setCases(list);

      if (!selectedCase && list[0]) {
        setSelectedCase(list[0]);
      }
    } catch {
      setError("Impossible de charger les dossiers douane.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resolveSelectedCase() {
    if (!selectedCase) return;

    setSaving(true);
    setError("");

    try {
      const resolved = await resolveCustomsCase(selectedCase.id);
      const list = (await getCustomsCases()) as CustomsCase[];
      setCases(list);
      setSelectedCase(resolved || list.find((item) => item.id === selectedCase.id) || null);
    } catch {
      setError("Impossible de résoudre ce cas douane.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CargoPageShell
      title="Customs Control"
      description="Pilotez les cas douane, blocages compliance et risques avant libération des colis."
      eyebrow="Compliance Desk"
      action={<RefreshButton onClick={load} />}
    >
      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Ouverts" value={String(stats.open)} hint="Cas nécessitant une action" />
        <MetricCard label="High risk" value={String(stats.highRisk)} hint="Priorité compliance" />
        <MetricCard label="Bloquants" value={String(stats.blocked)} hint="Peut bloquer livraison" />
        <MetricCard label="Résolus" value={String(stats.resolved)} hint="Libération validée" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[430px_1fr]">
        <CargoCard>
          <div className="border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  File douane
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cas ouverts par shipment ou batch.
                </p>
              </div>
              <StatusPill label={`${filteredCases.length} cas`} tone="info" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <FilterSelect
                label="Statut"
                value={statusFilter}
                options={STATUS_FILTERS}
                onChange={setStatusFilter}
              />
              <FilterSelect
                label="Risque"
                value={riskFilter}
                options={RISK_FILTERS}
                onChange={setRiskFilter}
              />
            </div>
          </div>

          <div className="mt-5 max-h-[660px] space-y-3 overflow-auto pr-1">
            {loading && <EmptyState label="Chargement des cas douane..." />}
            {!loading && filteredCases.length === 0 && (
              <EmptyState label="Aucun cas douane pour ces filtres." />
            )}

            {filteredCases.map((item) => {
              const isSelected = selectedCase?.id === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedCase(item)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    isSelected
                      ? "border-amber-200 bg-amber-50 shadow-sm"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950">
                        {item.case_code}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-400">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                    <StatusPill
                      label={item.customs_status}
                      tone={getCustomsTone(item.customs_status)}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill
                      label={`Risk ${item.risk_level}`}
                      tone={getRiskTone(item.risk_level)}
                    />
                    {item.country_code && (
                      <StatusPill label={item.country_code} tone="neutral" />
                    )}
                  </div>

                  <p className="mt-4 line-clamp-2 text-sm text-slate-600">
                    {item.goods_description || item.blocked_reason || "Description non renseignée"}
                  </p>
                </button>
              );
            })}
          </div>
        </CargoCard>

        <CargoCard>
          {!selectedCase && (
            <div className="flex min-h-[520px] items-center justify-center text-center">
              <div>
                <FileWarning className="mx-auto text-slate-300" size={46} />
                <div className="mt-4 text-lg font-black text-slate-950">
                  Sélectionnez un cas
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Le détail compliance apparaîtra ici.
                </p>
              </div>
            </div>
          )}

          {selectedCase && (
            <div>
              <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <StatusPill
                    label={selectedCase.customs_status}
                    tone={getCustomsTone(selectedCase.customs_status)}
                  />
                  <h2 className="mt-4 text-3xl font-black text-slate-950">
                    {selectedCase.case_code}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Ouvert par {selectedCase.opened_by_name || "SLAIVIO"} •{" "}
                    {new Date(selectedCase.created_at).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={resolveSelectedCase}
                  disabled={saving || selectedCase.customs_status === "RESOLVED"}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {selectedCase.customs_status === "RESOLVED"
                    ? "Déjà résolu"
                    : saving
                      ? "Résolution..."
                      : "Marquer résolu"}
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <DetailCard
                  icon={<AlertTriangle size={18} />}
                  label="Risque"
                  value={selectedCase.risk_level || "UNKNOWN"}
                />
                <DetailCard
                  icon={<ShieldCheck size={18} />}
                  label="Pays"
                  value={selectedCase.country_code || "-"}
                />
                <DetailCard
                  icon={<UserCheck size={18} />}
                  label="Responsable"
                  value={selectedCase.opened_by_name || "-"}
                />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-black text-slate-950">
                    Marchandise
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedCase.goods_description || "Description non renseignée."}
                  </p>
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      Valeur déclarée
                    </div>
                    <div className="mt-2 font-black text-slate-950">
                      {selectedCase.declared_value || 0}{" "}
                      {selectedCase.declared_currency || ""}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-lg font-black text-amber-950">
                    Raison du blocage
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-amber-800">
                    {selectedCase.blocked_reason ||
                      "Aucune raison bloquante renseignée pour ce cas."}
                  </p>
                </section>
              </div>

              {selectedCase.customs_status === "RESOLVED" && (
                <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 text-emerald-600" size={20} />
                    <div>
                      <div className="font-black text-emerald-950">
                        Cas libéré
                      </div>
                      <p className="mt-1 text-sm text-emerald-700">
                        Résolu par {selectedCase.resolved_by_name || "SLAIVIO"}{" "}
                        {selectedCase.resolved_at
                          ? `le ${new Date(selectedCase.resolved_at).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CargoCard>
      </section>
    </CargoPageShell>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
        <Filter size={13} />
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailCard({
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

function getCustomsTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "RESOLVED") return "success";
  if (["BLOCKED", "OPEN", "PENDING"].includes(status)) return "warning";
  if (["FAILED", "REJECTED"].includes(status)) return "danger";
  return "neutral";
}

function getRiskTone(risk: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (risk === "HIGH") return "danger";
  if (risk === "MEDIUM") return "warning";
  if (risk === "LOW") return "success";
  return "neutral";
}
