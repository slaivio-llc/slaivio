import { api } from "@/services/api";
import type {
  ConversationInternalNote,
  ConversationTimelineEvent,
} from "@/types/inbox";

export async function getConversationNotes(
  phone: string
): Promise<ConversationInternalNote[]> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/notes`
  );

  return response.data.notes;
}

export async function createConversationNote(
  phone: string,
  data: {
    note: string;
    manager_id?: string | null;
    manager_name?: string | null;
  }
): Promise<ConversationInternalNote> {
  const response = await api.post(
    `/inbox/conversations/${encodeURIComponent(phone)}/notes`,
    data
  );

  return response.data.note;
}

export async function getConversationTimeline(
  phone: string
): Promise<ConversationTimelineEvent[]> {
  const response = await api.get(
    `/inbox/conversations/${encodeURIComponent(phone)}/timeline`
  );

  return response.data.events;
}
