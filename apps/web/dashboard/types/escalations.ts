export type Escalation = {
  id: string;

  org_id: string;

  client_id: string | null;
  dossier_id: string | null;

  reason: string;
  priority: string;
  status: string;

  assigned_to: string | null;
  resolution_note: string | null;

  client_phone: string | null;
  client_name: string | null;

  case_type: string | null;
  dossier_status: string | null;

  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};
