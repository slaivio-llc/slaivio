import { api } from "@/services/api";
import type { AIDraftResponse } from "@/types/inbox";

export async function generateAIDraft(
  phone: string,
  data: {
    source_message: string;
    manager_id?: string | null;
    manager_name?: string | null;
  }
): Promise<AIDraftResponse> {
  const response = await api.post(
    `/inbox/conversations/${encodeURIComponent(phone)}/ai-draft`,
    data
  );

  return response.data.draft;
}

export async function getAIDrafts(
  phone: string
): Promise<AIDraftResponse[]> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/ai-drafts`
  );

  return response.data.drafts;
}

