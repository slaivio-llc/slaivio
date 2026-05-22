export type Conversation = {
  from_phone: string;
  last_message_at: string;
  last_message: string | null;
  message_count: number;
};

export type InboxMessage = {
  id: string;
  org_id: string;
  dossier_id: string | null;
  client_id: string | null;
  from_phone: string;
  to_phone: string | null;
  text_body: string | null;
  direction: "inbound" | "outbound";
  source_channel: string;
  created_at: string;
};