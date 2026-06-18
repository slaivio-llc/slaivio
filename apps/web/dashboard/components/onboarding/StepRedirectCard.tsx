"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { completeOnboardingStep } from "@/services/onboarding-experience";

export function StepRedirectCard({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  completeStepKey,
  nextHref,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  completeStepKey: string;
  nextHref: string;
}) {
  const router = useRouter();

  async function markComplete() {
    await completeOnboardingStep(completeStepKey);
    router.push(nextHref);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-black text-white"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
          <button
            onClick={markComplete}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-4 font-black text-slate-700"
          >
            <CheckCircle2 size={16} />
            Marquer terminé
          </button>
        </div>
        <p className="mt-5 text-sm text-slate-500">
          Marquez terminé seulement lorsque la configuration réelle existe en
          production.
        </p>
      </section>
    </main>
  );
}
