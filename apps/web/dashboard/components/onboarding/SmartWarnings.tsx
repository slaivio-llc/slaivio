import { AlertTriangle } from "lucide-react";

import type { OnboardingWarning } from "@/services/onboarding-experience";

export function SmartWarnings({
  warnings,
}: {
  warnings: OnboardingWarning[];
}) {
  if (!warnings?.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {warnings.map((warning) => (
        <div
          key={warning.key}
          className="rounded-3xl border border-amber-200 bg-amber-50 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="font-black text-slate-950">
                {warning.title}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {warning.message}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
