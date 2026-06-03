import { api } from "@/services/api";
import type { InboxMessage } from "@/types/inbox";

export async function sendConversationReply(
  phone: string,
  data: {
    message: string;
    preferred_role?: string | null;
    manager_id?: string | null;
    manager_name?: string | null;
  }
): Promise<InboxMessage> {
  const response = await api.post(
    `/inbox/conversations/${encodeURIComponent(phone)}/reply`,
    data
  );

  return response.data.message;
}
