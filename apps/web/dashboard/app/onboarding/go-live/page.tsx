"use client";

import { useEffect, useState } from "react";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import {
  completeOnboardingStep,
  getOnboardingExperienceState,
  type OnboardingExperienceState,
} from "@/services/onboarding-experience";

export default function GoLivePage() {
  const [state, setState] = useState<OnboardingExperienceState | null>(null);

  useEffect(() => {
    getOnboardingExperienceState().then(setState);
  }, []);

  async function goLive() {
    await completeOnboardingStep("GO_LIVE");
    window.location.href = "/app";
  }

  if (!state) return <main className="p-8">Chargement...</main>;

  const canGoLive = state.readiness_score >= 90;

  return (
    <OnboardingShell state={state}>
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
          Final step
        </p>
        <h1 className="mt-2 text-4xl font-black text-slate-950">
          Votre agence est presque prête.
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          Go live seulement quand l’agence est prête à gérer vrais clients,
          vrais messages, vrais colis et vraies livraisons.
        </p>
        <div className="mt-8 rounded-3xl bg-slate-50 p-6">
          <p className="text-sm font-semibold text-slate-500">
            Readiness Score
          </p>
          <p className="mt-2 text-5xl font-black text-slate-950">
            {state.readiness_score}%
          </p>
        </div>
        <button
          onClick={goLive}
          disabled={!canGoLive}
          className="mt-8 rounded-2xl bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-40"
        >
          Go Live
        </button>
        {!canGoLive && (
          <p className="mt-3 text-sm font-semibold text-red-700">
            Complétez les étapes requises avant la mise en production.
          </p>
        )}
      </div>
    </OnboardingShell>
  );
}
