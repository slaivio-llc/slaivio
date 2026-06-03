export type Conversation = {
  org_id: string;
  from_phone: string;
  last_message_at: string;
  last_message: string | null;
  message_count: number;
  number_role: string | null;
  provider_phone_number_id: string | null;
  whatsapp_number_id: string | null;
  conversation_status: string | null;
  priority: string | null;
  queue_name: string | null;
  unread_count: number;
  requires_attention: boolean;
  assigned_manager_id: string | null;
  assigned_manager_name: string | null;
  last_note: string | null;
  waiting_since: string | null;
};

export type QueueSummary = {
  queue_name: string;
  total: number;
};

export type InboxMessage = {
  id: string;
  org_id: string;
  from_phone: string;
  to_phone: string | null;
  direction: "inbound" | "outbound";
  text_body: string | null;
  provider: string | null;
  provider_message_id: string | null;
  provider_phone_number_id: string | null;
  whatsapp_number_id: string | null;
  waba_id: string | null;
  number_role: string | null;
  conversation_status: string | null;
  priority: string | null;
  assigned_manager_id: string | null;
  send_status: string | null;
  error_message: string | null;
  created_at: string;
};

export type ConversationAssignment = {
  id: string;
  org_id: string;
  client_phone: string;
  assigned_manager_id: string | null;
  assigned_manager_name: string | null;
  status: string;
  priority: string;
  last_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationInternalNote = {
  id: string;
  org_id: string;
  client_phone: string;
  manager_id: string | null;
  manager_name: string | null;
  note: string;
  created_at: string;
};

export type ConversationTimelineEvent = {
  id: string;
  org_id: string;
  client_phone: string;
  event_type: string;
  event_title: string | null;
  event_payload: unknown;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type AgentPresence = {
  id: string;
  org_id: string;
  manager_id: string;
  manager_name: string | null;
  status: "ONLINE" | "OFFLINE" | "AWAY" | string;
  active_conversation: string | null;
  last_seen: string;
  created_at: string;
};
