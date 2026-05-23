"use client";

import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

import {
  createBroadcast,
  getBroadcasts,
} from "@/services/broadcasts";

import type {
  BroadcastCampaign,
} from "@/types/broadcasts";

export default function BroadcastsPage() {
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    try {
      const data = await getBroadcasts();
      setCampaigns(data);
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
    <DashboardLayout>
      <div className="p-8">
        <div>
          <h1 className="text-3xl font-bold">
            Broadcasts
          </h1>

          <p className="mt-2 text-gray-500">
            Campagnes WhatsApp clients
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <section className="mt-8 rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">
            Nouvelle campagne
          </h2>

          <div className="mt-5 space-y-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre campagne"
              className="w-full rounded-xl border px-4 py-3"
            />

            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Message WhatsApp..."
              className="min-h-[180px] w-full rounded-xl border px-4 py-3"
            />

            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {saving ? "Création..." : "Créer campagne"}
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold">
            Historique campagnes
          </h2>

          <div className="mt-5 grid gap-4">
            {loading && (
              <div className="text-gray-500">
                Chargement...
              </div>
            )}

            {!loading && campaigns.length === 0 && (
              <div className="rounded-2xl border p-6 text-sm text-gray-500">
                Aucune campagne pour le moment.
              </div>
            )}

            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-2xl border p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {campaign.title}
                    </h3>

                    <div className="mt-2 text-sm text-gray-500">
                      {campaign.audience_type}
                    </div>
                  </div>

                  <span className="rounded-full border px-3 py-1 text-xs">
                    {campaign.status}
                  </span>
                </div>

                <p className="mt-5 whitespace-pre-wrap text-sm">
                  {campaign.message_body}
                </p>

                <div className="mt-6 flex gap-6 text-sm text-gray-500">
                  <div>👥 {campaign.total_recipients}</div>
                  <div>✅ {campaign.total_sent}</div>
                  <div>❌ {campaign.total_failed}</div>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  {new Date(campaign.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}