import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import type { OnboardingStep } from "@/services/onboarding-experience";

export function OnboardingStepper({
  steps,
}: {
  steps: OnboardingStep[];
}) {
  return (
    <div className="mt-8 space-y-2">
      {steps.map((step) => {
        const Icon =
          step.status === "COMPLETED"
            ? CheckCircle2
            : step.status === "IN_PROGRESS"
              ? Loader2
              : Circle;

        return (
          <div
            key={step.step_key}
            className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm transition ${
              step.status === "IN_PROGRESS"
                ? "bg-white/10 text-white"
                : "text-slate-400"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon
                size={16}
                className={
                  step.status === "COMPLETED"
                    ? "text-emerald-300"
                    : step.status === "IN_PROGRESS"
                      ? "text-sky-300"
                      : "text-slate-500"
                }
              />
              <span className="truncate">{step.step_name}</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
              {step.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
