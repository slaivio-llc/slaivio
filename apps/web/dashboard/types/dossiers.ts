export type Dossier = {
  id: string;
  org_id: string;
  client_id: string;

  case_type: string;

  status_global: string;
  intake_status: string;
  validation_status: string;

  primary_channel: string;

  client_phone: string | null;
  client_name: string | null;

  message_count: number;

  created_at: string;
  updated_at: string;
};

export type DossierTimelineEvent = {
  id: string;
  event_type: string;
  event_payload: unknown;
  created_at: string;
};

export type DossierClient = {
  id: string;
  phone: string | null;
  name: string | null;
  email?: string | null;
  preferred_language?: string | null;
};

export type DossierMessage = {
  id: string;
  sender_phone: string | null;
  message_text: string | null;
  raw_payload: unknown;
  created_at: string;
};

export type DossierNotification = {
  id: string;
  channel: string | null;
  recipient_phone: string | null;
  notification_type: string | null;
  message: string | null;
  status: string | null;
  provider: string | null;
  provider_message_id: string | null;
  created_at: string;
  sent_at: string | null;
  failed_at: string | null;
  error_message: string | null;
};

export type DossierDetails = {
  dossier: Dossier;
  client?: DossierClient | null;
  messages?: DossierMessage[];
  timeline: DossierTimelineEvent[];
  notifications?: DossierNotification[];
};
