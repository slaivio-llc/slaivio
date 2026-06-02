import { api } from "@/services/api";

import type {
  ConversationAssignment,
} from "@/types/inbox";

export async function getConversationAssignment(
  phone: string
): Promise<ConversationAssignment | null> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/assignment`
  );

  return response.data.assignment;
}

export async function updateConversationAssignment(
  phone: string,
  data: {
    assigned_manager_id?: string | null;
    assigned_manager_name?: string | null;
    status: string;
    priority: string;
    last_note?: string | null;
  }
): Promise<ConversationAssignment> {
  const response = await api.patch(
    `/inbox/conversations/${encodeURIComponent(phone)}/assignment`,
    data
  );

  return response.data.assignment;
}
