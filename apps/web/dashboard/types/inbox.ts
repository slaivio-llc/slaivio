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
  assigned_manager_id: string | null;
  assigned_manager_name: string | null;
  last_note: string | null;
};

export type InboxMessage = {
  id: string;
  org_id: string;
  from_phone: string;
  to_phone: string | null;
  direction: string;
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
