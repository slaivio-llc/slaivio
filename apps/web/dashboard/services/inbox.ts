import { api } from "@/services/api";

import type {
  Conversation,
  InboxMessage,
} from "@/types/inbox";

export async function getConversations(filters?: {
  number_role?: string;
  status?: string;
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
