import { api } from "@/services/api";

export type LandingMetric = {
  metric_key: string;
  metric_label: string;
  metric_value: number;
};

export type LandingPricingPlan = {
  code: string;
  name: string;
  description: string | null;
  monthly_price_minor: number;
  currency_code: string;
  max_users: number | null;
  max_whatsapp_numbers: number | null;
  max_monthly_messages: number | null;
  ai_enabled: boolean;
  broadcasts_enabled: boolean;
  multi_number_enabled: boolean;
};

export type LandingTestimonial = {
  agency_name: string;
  country: string;
  owner_name: string | null;
  quote: string;
};

export async function getLandingData(): Promise<{
  metrics: LandingMetric[];
  pricing: LandingPricingPlan[];
  testimonials: LandingTestimonial[];
}> {
  const response = await api.get("/public/landing");

  return {
    metrics: response.data.metrics || [],
    pricing: response.data.pricing || [],
    testimonials: response.data.testimonials || [],
  };
}

export async function createDemoRequest(data: {
  full_name: string;
  email: string;
  agency_name?: string;
  phone?: string;
  country?: string;
  monthly_shipments?: string;
  message?: string;
}) {
  const response = await api.post("/public/demo-requests", data);

  return response.data.demo_request;
}

export async function createTrialLead(data: {
  email: string;
  agency_name?: string;
}) {
  const response = await api.post("/public/trial-leads", data);

  return response.data;
}
