"use client";

import { useCallback, useEffect, useState } from "react";
import axios from 'axios';

import { getOnboardingExperienceState, type OnboardingExperienceState } from "@/services/onboarding-experience";

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingExperienceState | null>(null);
  const [error, setError] = useState("");
  const [authenticationRequired,setAuthenticationRequired]=useState(false);
  const reload = useCallback(async () => {
    try {
      setState(await getOnboardingExperienceState());
      setError("");
      setAuthenticationRequired(false);
    } catch (cause) {
      const rejected=axios.isAxiosError(cause)&&cause.response?.status===401;
      setAuthenticationRequired(rejected);
      if(rejected)setState(null);
      setError(rejected?"Votre connexion n’a pas pu être validée. Reconnectez-vous pour reprendre la configuration.":"Votre configuration ne peut pas être chargée pour le moment.");
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { state, error, reload, authenticationRequired };
}
