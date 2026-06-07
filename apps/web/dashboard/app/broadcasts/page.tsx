"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Send, UsersRound } from "lucide-react";

import { CargoCard, CargoPageShell, EmptyState, StatusPill } from "@/components/cargo/cargo-page-shell";
import { createBroadcast, getBroadcasts } from "@/services/broadcasts";
import type { BroadcastCampaign } from "@/types/broadcasts";

export default function BroadcastsPage() {
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const stats = useMemo(() => {
    return {
      total: campaigns.length,
      recipients: campaigns.reduce((sum, item) => sum + (item.total_recipients || 0), 0),
      sent: campaigns.reduce((sum, item) => sum + (item.total_sent || 0), 0),
      failed: campaigns.reduce((sum, item) => sum + (item.total_failed || 0), 0),
    };
  }, [campaigns]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      setCampaigns(await getBroadcasts());
    } catch {
      setError("Impossible de charger les campagnes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!title.trim() || !messageBody.trim()) {
      setError("Titre et message obligatoires.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createBroadcast({
        title: title.trim(),
        message_body: messageBody.trim(),
        audience_type: "ALL_CLIENTS",
      });

      setTitle("");
      setMessageBody("");
      setSuccess("Campagne créée avec succès.");
      await load();
    } catch {
      setError("Impossible de créer la campagne.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CargoPageShell
      title="Broadcast Command Center"
      description="Créez et suivez les campagnes WhatsApp clients avec un contrôle opérationnel clair."
      eyebrow="Customer Communication"
    >
      {(error || success) && (
        <div
          className={`rounded-2xl p-4 text-sm font-medium ${
            error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || success}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Campagnes" value={String(stats.total)} hint="Historique total" />
        <Metric label="Audience" value={String(stats.recipients)} hint="Destinataires ciblés" />
        <Metric label="Envoyés" value={String(stats.sent)} hint="Messages transmis" />
        <Metric label="Échecs" value={String(stats.failed)} hint="À inspecter" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CargoCard>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Nouvelle campagne
              </h2>
              <p className="text-sm text-slate-500">Audience : tous les clients</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre campagne"
              className="slaivo-focus w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Message WhatsApp..."
              className="slaivo-focus min-h-[220px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {saving ? "Création..." : "Créer campagne"}
            </button>
          </div>
        </CargoCard>

        <CargoCard>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Historique campagnes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Suivi des diffusions et résultats.
              </p>
            </div>
            <Megaphone className="text-slate-300" size={28} />
          </div>

          <div className="mt-5 space-y-3">
            {loading && <EmptyState label="Chargement..." />}
            {!loading && campaigns.length === 0 && (
              <EmptyState label="Aucune campagne pour le moment." />
            )}

            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-slate-950">{campaign.title}</h3>
                    <div className="mt-1 text-sm text-slate-500">
                      {campaign.audience_type}
                    </div>
                  </div>
                  <StatusPill label={campaign.status} tone="info" />
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {campaign.message_body}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <UsersRound size={14} /> {campaign.total_recipients}
                  </span>
                  <span>Envoyés {campaign.total_sent}</span>
                  <span>Échecs {campaign.total_failed}</span>
                </div>
              </div>
            ))}
          </div>
        </CargoCard>
      </div>
    </CargoPageShell>
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

