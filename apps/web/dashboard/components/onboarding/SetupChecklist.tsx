import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import type { OnboardingStep } from "@/services/onboarding-experience";

export function SetupChecklist({
  steps,
}: {
  steps: OnboardingStep[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {steps.map((step) => {
        const isDone = step.status === "COMPLETED";
        const path = `/onboarding/${step.step_key.toLowerCase().replaceAll("_", "-")}`;

        return (
          <div
            key={step.step_key}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-2xl p-2 ${
                    isDone
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </div>
                <div>
                  <h3 className="font-black text-slate-950">
                    {step.step_name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {step.required
                      ? "Required for production launch."
                      : "Recommended for team operations."}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                {step.status}
              </span>
            </div>

            <Link
              href={path}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Configure
              <ArrowRight size={15} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
