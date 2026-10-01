"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OnboardingLoading } from "@/components/onboarding/OnboardingShell";
import { getOnboardingExperienceState } from "@/services/onboarding-experience";

const routes: Record<string, string> = {
  WELCOME: "/onboarding/welcome",
  AGENCY_PROFILE: "/onboarding/agency-profile",
  OPERATIONS: "/onboarding/operations",
  WHATSAPP: "/onboarding/whatsapp",
  AI_KNOWLEDGE: "/onboarding/ai-knowledge",
  REVIEW: "/onboarding/review",
  GO_LIVE: "/onboarding/go-live",
};

export default function OnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    getOnboardingExperienceState()
      .then((state) => router.replace(routes[state.current_step?.step_key || ""] || (state.journey.status === "COMPLETED" ? "/app" : "/onboarding/welcome")))
      .catch(() => router.replace("/onboarding/welcome"));
  }, [router]);
  return <OnboardingLoading/>;
}
