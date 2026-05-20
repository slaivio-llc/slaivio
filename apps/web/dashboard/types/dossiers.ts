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

export type DossierDetails = {
  dossier: Dossier;
  timeline: DossierTimelineEvent[];
};
