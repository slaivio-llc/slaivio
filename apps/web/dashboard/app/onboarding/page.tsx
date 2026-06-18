"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { SmartWarnings } from "@/components/onboarding/SmartWarnings";
import {
  getOnboardingExperienceState,
  type OnboardingExperienceState,
} from "@/services/onboarding-experience";
import { refreshOnboarding } from "@/services/onboarding";

export default function OnboardingPage() {
  const [state, setState] = useState<OnboardingExperienceState | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadState() {
    const data = await getOnboardingExperienceState();
    setState(data);
  }

  useEffect(() => {
    loadState().finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setLoading(true);
    await refreshOnboarding();
    await loadState();
    setLoading(false);
  }

  if (loading || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-slate-950" />
          <div className="mt-4 font-black">Chargement onboarding...</div>
        </div>
      </main>
    );
  }

  return (
    <OnboardingShell state={state}>
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
            Agency onboarding
          </p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                Configurez votre agence cargo pour la production.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Avant d’ouvrir le dashboard aux opérations réelles, SLAIVIO
                vérifie les bureaux, warehouses, routes, prix, règles cargo,
                notifications, équipe et WhatsApp officiel.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-slate-300">Current step</p>
              <div className="mt-2 text-2xl font-black">
                {state.current_step?.step_name || "Completed"}
              </div>
              <Link
                href={
                  state.current_step
                    ? `/onboarding/${state.current_step.step_key
                        .toLowerCase()
                        .replaceAll("_", "-")}`
                    : "/onboarding/review"
                }
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Continuer
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Progress" value={`${state.progress}%`} />
          <Stat label="Readiness Score" value={`${state.readiness_score}%`} />
          <Stat label="Required Steps" value={`${state.steps.filter((step) => step.required).length}`} />
        </div>

        <div className="mt-6">
          <SmartWarnings warnings={state.warnings || []} />
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
                Production checklist
              </p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">
                Les blocs à finaliser
              </h2>
            </div>
            <button
              onClick={refresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={15} />
              Rafraîchir
            </button>
          </div>
          <SetupChecklist steps={state.steps || []} />
        </div>
      </div>
    </OnboardingShell>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}
