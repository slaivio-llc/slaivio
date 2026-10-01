"use client";

import { useCallback, useEffect, useState } from "react";

import { getOnboardingExperienceState, type OnboardingExperienceState } from "@/services/onboarding-experience";

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingExperienceState | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setState(await getOnboardingExperienceState());
      setError("");
    } catch {
      setError("Votre configuration ne peut pas être chargée pour le moment.");
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { state, error, reload };
}
