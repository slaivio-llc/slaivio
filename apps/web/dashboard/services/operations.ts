import { api } from "@/services/api";

export type OperationalInsight = {
  id: string;
  org_id: string;
  insight_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  message: string;
  recommended_action: string | null;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED" | string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export async function getOperationalInsights(filters?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<OperationalInsight[]> {
  const response = await api.get("/operations/insights", {
    params: filters,
  });

  return response.data.insights;
}

export async function runOperationsDetection() {
  const response = await api.post("/operations/insights/run-detection");

  return response.data;
}

export async function acknowledgeInsight(id: string) {
  const response = await api.post(
    `/operations/insights/${id}/acknowledge`
  );

  return response.data.insight;
}

export async function resolveInsight(id: string) {
  const response = await api.post(
    `/operations/insights/${id}/resolve`
  );

  return response.data.insight;
}

export async function dismissInsight(id: string) {
  const response = await api.post(
    `/operations/insights/${id}/dismiss`
  );

  return response.data.insight;
}
