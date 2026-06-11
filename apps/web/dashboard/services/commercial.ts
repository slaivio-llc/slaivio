import { api } from "@/services/api";

export type CommercialCase = {
  id: string;
  case_type: string;
  status: string;
  priority: string;
  detected_intent: string | null;
  missing_fields: string[];
  last_customer_message: string | null;
  created_at: string;
};

export type CommercialQuote = {
  id: string;
  service_name: string | null;
  total_minor: number | null;
  currency_code: string | null;
  eta_min_days: number | null;
  eta_max_days: number | null;
  restriction_decision: string | null;
  status: string;
  created_at: string;
};

export type CommercialTask = {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_team: string | null;
  created_at: string;
};

export async function processCommercialMessage(data: {
  phone: string;
  message: string;
  source_channel?: string;
}) {
  const response = await api.post("/commercial/message", data);

  return response.data.result;
}

export async function getCommercialCases(): Promise<CommercialCase[]> {
  const response = await api.get("/commercial/cases");

  return response.data.cases;
}

export async function getCommercialQuotes(): Promise<CommercialQuote[]> {
  const response = await api.get("/commercial/quotes");

  return response.data.quotes;
}

export async function getCommercialTasks(): Promise<CommercialTask[]> {
  const response = await api.get("/commercial/tasks");

  return response.data.tasks;
}
