import { api } from "@/services/api";
import type { Escalation } from "@/types/escalations";

export async function getEscalations(): Promise<Escalation[]> {
  const response = await api.get("/escalations");

  return response.data.escalations;
}

export async function updateEscalation(
  escalationId: string,
  data: {
    status: string;
    resolution_note?: string;
  }
): Promise<Escalation> {
  const response = await api.patch(
    `/escalations/${escalationId}`,
    data
  );

  return response.data.escalation;
}