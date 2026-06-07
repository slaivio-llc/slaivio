"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Inbox,
  MessageSquare,
  Package,
  Route,
  UserRound,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getDossier, getDossiers } from "@/services/dossiers";
import type { Dossier, DossierDetails } from "@/types/dossiers";

export default function DossiersPage() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [selected, setSelected] = useState<DossierDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const partial = dossiers.filter(
      (dossier) => dossier.intake_status === "PARTIAL"
    ).length;
    const validated = dossiers.filter(
      (dossier) => dossier.validation_status === "APPROVED"
    ).length;
    const leads = dossiers.filter(
      (dossier) => dossier.status_global === "LEAD"
    ).length;

    return {
      total: dossiers.length,
      partial,
      validated,
      leads,
    };
  }, [dossiers]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await getDossiers();
      setDossiers(data);

      if (!selected && data[0]) {
        setSelected(await getDossier(data[0].id));
      }
    } catch {
      setError("Impossible de charger les dossiers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openDossier(dossierId: string) {
    setOpening(true);
    setError("");

    try {
      setSelected(await getDossier(dossierId));
    } catch {
      setError("Impossible de charger ce dossier.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <DashboardLayout>
      <main className="p-4 md:p-8">
        <section className="slaivo-gradient-card rounded-[2rem] p-6 text-white md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
                <FileText size={14} />
                Dossier Operations
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Dossiers Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Gérez les demandes client, validations, informations manquantes,
                conversations et événements avant création shipment.
              </p>
            </div>

            <button
              onClick={load}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-xl transition hover:-translate-y-0.5"
            >
              Rafraîchir les dossiers
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Total" value={String(stats.total)} hint="Dossiers actifs" />
          <Metric label="Leads" value={String(stats.leads)} hint="Demandes entrantes" />
          <Metric label="Partiels" value={String(stats.partial)} hint="Infos à compléter" />
          <Metric label="Validés" value={String(stats.validated)} hint="Prêts opération" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="slaivo-card max-h-[calc(100vh-260px)] overflow-hidden rounded-[2rem]">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-black text-slate-950">
                Dossiers actifs
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Cliquez pour ouvrir le détail.
              </p>
            </div>

            <div className="max-h-[calc(100vh-360px)] overflow-auto p-3">
              {loading && (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Chargement...
                </div>
              )}

              {!loading && dossiers.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Aucun dossier actif.
                </div>
              )}

              <div className="space-y-2">
                {dossiers.map((dossier) => {
                  const isSelected = selected?.dossier.id === dossier.id;

                  return (
                    <button
                      key={dossier.id}
                      disabled={opening}
                      onClick={() => openDossier(dossier.id)}
                      className={`w-full rounded-3xl border p-4 text-left transition disabled:opacity-60 ${
                        isSelected
                          ? "border-sky-200 bg-sky-50 shadow-sm"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-950">
                            {dossier.client_phone || "Client inconnu"}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {dossier.client_name || "Nom non renseigné"}
                          </div>
                        </div>
                        <StatusBadge status={dossier.status_global} />
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                        <Route size={15} className="text-slate-400" />
                        <span className="truncate">
                          {dossier.case_type || "Type inconnu"}
                        </span>
                        <ArrowRight size={14} className="text-slate-300" />
                        <span className="truncate">
                          {dossier.primary_channel || "WhatsApp"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <MiniPill label={dossier.intake_status} />
                        <MiniPill label={dossier.validation_status} />
                        <MiniPill label={`${dossier.message_count || 0} msg`} />
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
                  <FileText className="mx-auto text-slate-300" size={44} />
                  <div className="mt-4 text-lg font-bold text-slate-950">
                    Sélectionnez un dossier
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Le profil client, les messages et la timeline apparaîtront ici.
                  </div>
                </div>
              </div>
            )}

            {selected && <DossierDetail selected={selected} />}
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}

function DossierDetail({
  selected,
}: {
  selected: DossierDetails;
}) {
  const dossier = selected.dossier;
  const messages = selected.messages || [];
  const notifications = selected.notifications || [];
  const recentEvents = selected.timeline.slice(-4).reverse();

  return (
    <div className="space-y-6">
      <div className="slaivo-card rounded-[2rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusBadge status={dossier.status_global} />
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              {dossier.client_phone || "Client inconnu"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {dossier.client_name || "Nom non renseigné"} •{" "}
              {dossier.case_type || "Type inconnu"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {dossier.primary_channel || "whatsapp"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <InfoCard
            icon={<ClipboardCheck size={18} />}
            label="Validation"
            value={dossier.validation_status || "-"}
          />
          <InfoCard
            icon={<Inbox size={18} />}
            label="Intake"
            value={dossier.intake_status || "-"}
          />
          <InfoCard
            icon={<MessageSquare size={18} />}
            label="Messages"
            value={String(messages.length || dossier.message_count || 0)}
          />
          <InfoCard
            icon={<UserRound size={18} />}
            label="Client"
            value={selected.client?.preferred_language || "FR"}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Activité récente"
          subtitle="Vue compacte des derniers événements dossier."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {selected.timeline.length === 0 && (
              <EmptyPanel label="Aucun événement pour ce dossier." />
            )}

            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-3xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-950">
                      {formatEventTitle(event.event_type)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(event.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                </div>
                <EventPayloadSummary compact payload={event.event_payload} />
              </div>
            ))}
          </div>

          {selected.timeline.length > recentEvents.length && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              {selected.timeline.length - recentEvents.length} ancien(s)
              événement(s) masqué(s) pour garder la vue lisible.
            </div>
          )}
        </Panel>

        <Panel
          title="Messages & notifications"
          subtitle="Derniers échanges liés au dossier."
        >
          <div className="space-y-4">
            {messages.length === 0 && notifications.length === 0 && (
              <EmptyPanel label="Aucun message ou notification lié." />
            )}

            {messages.slice(-6).map((message) => (
              <div
                key={message.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Message entrant
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  {message.message_text || "Message sans texte"}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {new Date(message.created_at).toLocaleString()}
                </div>
              </div>
            ))}

            {notifications.slice(-4).map((notification) => (
              <div
                key={notification.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Notification
                  </div>
                  <MiniPill label={notification.status || "PENDING"} />
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  {notification.message || "Notification sans contenu"}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function formatEventTitle(eventType: string) {
  return (eventType || "EVENT")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function EventPayloadSummary({
  payload,
  compact = false,
}: {
  payload: any;
  compact?: boolean;
}) {
  if (!payload || typeof payload !== "object") {
    return (
      <p className="mt-3 text-sm text-slate-500">
        Aucun détail supplémentaire.
      </p>
    );
  }

  const aiResult = payload.ai_result || {};
  const missingFields =
    aiResult.missing_fields || payload.missing_fields || [];
  const confidence = aiResult.confidence ?? payload.confidence;
  const text = payload.text || payload.message || payload.content;
  const intent = aiResult.intent || payload.intent;
  const language = aiResult.language || payload.language;
  const source = payload.source || aiResult.source;

  return (
    <div className="mt-4 space-y-3">
      <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        {intent && <SummaryItem label="Intention" value={intent} />}
        {source && <SummaryItem label="Source" value={source} />}
        {!compact && language && <SummaryItem label="Langue" value={language} />}
        {confidence !== undefined && !compact && (
          <SummaryItem
            label="Confiance IA"
            value={`${Math.round(Number(confidence) * 100)}%`}
          />
        )}
      </div>

      {text && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Message client
          </div>
          <p className={`${compact ? "line-clamp-2" : ""} mt-2 text-sm leading-6 text-slate-700`}>
            {text}
          </p>
        </div>
      )}

      {missingFields.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
            Informations manquantes
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingFields.slice(0, compact ? 3 : missingFields.length).map((field: string) => (
              <MiniPill key={field} label={field} />
            ))}
            {compact && missingFields.length > 3 && (
              <MiniPill label={`+${missingFields.length - 3}`} />
            )}
          </div>
        </div>
      )}

      {!intent && !source && !language && confidence === undefined && !text && (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          Événement enregistré sans données métier affichables.
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800">
        {value}
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
        <span className="text-emerald-600">{icon}</span>
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
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="slaivo-card rounded-[2rem] p-6">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyPanel({
  label,
}: {
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
      {label}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
      {status || "UNKNOWN"}
    </span>
  );
}

function MiniPill({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
      {label || "-"}
    </span>
  );
}
