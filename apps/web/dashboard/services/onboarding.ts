import { api } from "@/services/api";

export type AgencyProfilePayload = {
  legal_name?: string | null;
  brand_name: string;
  country: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  default_language?: string | null;
  default_currency?: string | null;
  business_type?: string | null;
};

export async function getOnboardingStatus() {
  const response = await api.get("/api/onboarding/status");
  return response.data.onboarding;
}

export async function saveAgencyProfile(data: AgencyProfilePayload) {
  const response = await api.post("/api/onboarding/agency-profile", data);
  return response.data.data;
}

export async function refreshOnboarding() {
  const response = await api.post("/api/onboarding/refresh");
  return response.data.onboarding;
}
