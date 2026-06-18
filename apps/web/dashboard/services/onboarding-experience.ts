import { api } from "@/services/api";

export type OnboardingStep = {
  id: string;
  step_key: string;
  step_name: string;
  step_order: number;
  required: boolean;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
};

export type OnboardingWarning = {
  key: string;
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export type OnboardingExperienceState = {
  journey: Record<string, unknown>;
  steps: OnboardingStep[];
  progress: number;
  readiness_score: number;
  current_step: OnboardingStep | null;
  warnings: OnboardingWarning[];
};

export async function getOnboardingExperienceState(): Promise<OnboardingExperienceState> {
  const response = await api.get("/api/onboarding-experience/state");
  return response.data.data;
}

export async function completeOnboardingStep(stepKey: string): Promise<OnboardingExperienceState> {
  const response = await api.post("/api/onboarding-experience/complete-step", {
    step_key: stepKey,
  });

  return response.data.data;
}

export async function trackOnboardingExperienceEvent(data: {
  step_key?: string | null;
  event_name: string;
  payload?: Record<string, unknown>;
}) {
  const response = await api.post("/api/onboarding-experience/events", data);
  return response.data.event;
}
