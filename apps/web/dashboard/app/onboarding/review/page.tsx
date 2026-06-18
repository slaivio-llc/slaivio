"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { SmartWarnings } from "@/components/onboarding/SmartWarnings";
import {
  getOnboardingExperienceState,
  type OnboardingExperienceState,
} from "@/services/onboarding-experience";

export default function OnboardingReviewPage() {
  const [state, setState] = useState<OnboardingExperienceState | null>(null);

  useEffect(() => {
    getOnboardingExperienceState().then(setState);
  }, []);

  if (!state) return <main className="p-8">Chargement...</main>;

  return (
    <OnboardingShell state={state}>
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">
            Review your agency setup
          </h1>
          <p className="mt-3 text-slate-600">
            Vérifiez tous les éléments requis avant d’ouvrir SLAIVIO aux vraies
            opérations.
          </p>
          <div className="mt-6">
            <SmartWarnings warnings={state.warnings || []} />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {state.steps.map((step) => (
            <div
              key={step.step_key}
              className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h3 className="font-black text-slate-950">{step.step_name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Required: {step.required ? "Yes" : "No"}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {step.status}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/onboarding/go-live"
          className="mt-8 inline-flex rounded-2xl bg-slate-950 px-6 py-4 font-black text-white"
        >
          Continue to Go Live
        </Link>
      </div>
    </OnboardingShell>
  );
}
