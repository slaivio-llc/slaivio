import { api } from "@/services/api";
import type { Conversation, InboxMessage } from "@/types/inbox";

export async function getConversations(filters?: {
  number_role?: string;
  status?: string;
  queue_name?: string;
  priority?: string;
  requires_attention?: boolean;
}): Promise<Conversation[]> {
  const response = await api.get("/inbox/conversations", {
    params: filters,
  });

  return response.data.conversations;
}

export async function getConversationMessages(
  phone: string
): Promise<InboxMessage[]> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/messages`
  );

  return response.data.messages;
}

export async function updateConversationStatus(
  phone: string,
  status: string
): Promise<string> {
  const response = await api.patch(
    `/inbox/conversations/${encodeURIComponent(phone)}/status`,
    null,
    {
      params: {
        status,
      },
    }
  );

  return response.data.conversation_status;
}
