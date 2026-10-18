"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getPublicTracking, type TrackingItem } from "@/services/tracking";

type PublicItem = TrackingItem & {
  events: Array<{
    event_type: string;
    title: string;
    description: string | null;
    occurred_at: string;
  }>;
};

export default function Page() {
  const { token } = useParams<{ token: string }>();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicTracking(token).then(setItem).catch(() => {
      setError("Ce lien de suivi est invalide ou expiré.");
    });
  }, [token]);

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Suivi indisponible</h1>
        <p className="mt-2 text-slate-600">{error}</p>
      </div>
    </main>;
  }

  if (!item) return <main className="grid min-h-screen place-items-center">Chargement du suivi…</main>;

  const progress = item.progress_percent == null ? "Non renseignée" : `${item.progress_percent}%`;
  const facts: Array<[string, string]> = [
    ["Statut", item.status],
    ["Position", item.last_location || "Non renseignée"],
    ["ETA", item.eta_at ? new Date(item.eta_at).toLocaleString("fr-FR") : "—"],
    ["Progression", progress],
  ];

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="bg-[#171c24] p-6 text-white">
        <p className="text-sm text-emerald-300">Slaivio Tracking</p>
        <h1 className="mt-2 text-3xl font-semibold">{item.tracking_id}</h1>
        <p className="mt-2">{item.origin_city || item.origin_country} → {item.destination_city || item.destination_country}</p>
      </header>
      <section className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        {facts.map(([label, value]) => <div key={label} className="bg-white p-4">
          <small className="text-slate-500">{label}</small>
          <p className="mt-1 font-semibold">{value}</p>
        </div>)}
      </section>
      <section className="p-6">
        <h2 className="font-semibold">Historique</h2>
        <div className="mt-4 space-y-4">
          {item.events.map((event, index) => <article key={`${event.event_type}-${event.occurred_at}-${index}`} className="border-l-2 border-emerald-400 pl-4">
            <time className="text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString("fr-FR")}</time>
            <h3 className="font-medium">{event.title}</h3>
            {event.description && <p className="text-sm text-slate-600">{event.description}</p>}
          </article>)}
          {!item.events.length && <p className="text-sm text-slate-500">Aucun événement enregistré.</p>}
        </div>
      </section>
    </div>
  </main>;
}
