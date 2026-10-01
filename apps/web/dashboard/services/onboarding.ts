import { api } from "@/services/api";

export type AgencyProfilePayload = {
  legal_name: string;
  brand_name: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  default_language: string;
  default_currency: string;
  business_type: "VEHICLE_IMPORT" | "PARCEL_FREIGHT";
};

export type AgencyProfile = AgencyProfilePayload & { id: string; org_id: string };

export async function getOnboardingStatus() {
  const response = await api.get<{ onboarding: Record<string, unknown>; profile: AgencyProfile | null }>("/api/onboarding/status");
  return response.data;
}

export async function saveAgencyProfile(data: AgencyProfilePayload) {
  const response = await api.post("/api/onboarding/agency-profile", data);
  return response.data.data;
}

export async function refreshOnboarding() {
  const response = await api.post("/api/onboarding/refresh");
  return response.data.onboarding;
}
