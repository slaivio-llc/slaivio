import { api } from "@/services/api";

export type ClientLifecycleStatus = "lead" | "active" | "pending" | "inactive" | "blocked";
export type ClientCustomerType = "individual" | "business" | "agent" | "partner";
export type ClientSource = "manual" | "whatsapp" | "website" | "referral" | "import" | "api";

export type ClientRecord = {
  id: string;
  org_id: string;
  display_name: string | null;
  name: string | null;
  company_name: string | null;
  tax_id?: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  address?: string | null;
  customer_type: ClientCustomerType;
  lifecycle_status: ClientLifecycleStatus;
  source: ClientSource;
  preferred_language?: string | null;
  preferred_currency?: string | null;
  notes?: string | null;
  credit_enabled: boolean;
  credit_limit: number;
  current_balance: number;
  total_spent: number;
  payment_amount_due: number;
  payment_amount_paid: number;
  payment_currency: string | null;
  payment_status: "NOT_SET" | "UNPAID" | "PARTIAL" | "PAID";
  dossiers_count: number;
  shipments_count: number;
  packages_count?: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  row_version: number;
  deleted_at?: string | null;
};

export type ClientTimelineEvent = {
  id: string;
  type: "client" | "dossier" | "shipment" | "message" | "followup" | string;
  title: string;
  description: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

export type ClientPackageSummary = {
  id: string;
  package_reference: string;
  tracking_id: string | null;
  status: string;
  weight_kg: number | null;
  destination_city: string | null;
  destination_country: string | null;
  received_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  updated_at: string;
  departure_id: string | null;
  departure_code: string | null;
  departure_scheduled_at: string | null;
  departure_status: string | null;
};

export type ClientMessageSummary = {
  id: string;
  direction: "inbound" | "outbound";
  text_body: string | null;
  message_type: string | null;
  send_status: string | null;
  error_message: string | null;
  from_phone: string | null;
  to_phone: string | null;
  sender_name: string | null;
  is_group: boolean;
  media_mime_type: string | null;
  media_file_name: string | null;
  created_at: string;
};

export type ClientFinanceDocument = {
  id: string;
  document_type: "QUOTE" | "INVOICE" | "CREDIT_NOTE";
  document_number: string;
  status: string;
  currency: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
};

export type ClientPaymentSummary = {
  id: string;
  receipt_number: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paid_at: string;
  status: string;
  document_id: string;
  document_number: string;
};

export type ClientWorkspace = {
  client: ClientRecord;
  packages: ClientPackageSummary[];
  messages: ClientMessageSummary[];
  documents: ClientFinanceDocument[];
  payments: ClientPaymentSummary[];
  summary: {
    packages: number;
    active_packages: number;
    messages: number;
    outstanding: number;
    paid: number;
  };
};

export type ClientDuplicate = Pick<
  ClientRecord,
  "id" | "display_name" | "name" | "company_name" | "phone" | "whatsapp_phone" | "email" | "country" | "city" | "customer_type" | "lifecycle_status" | "row_version"
> & {
  match_reason: "phone" | "email" | "name" | string;
  created_at: string;
};

export type ClientImportResult = {
  processed: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  clients: ClientRecord[];
};

export type ClientStats = {
  total: number;
  leads: number;
  active: number;
  pending: number;
  inactive: number;
  blocked: number;
  new_this_month: number;
};

export type ClientsResponse = {
  status: "ok";
  items: ClientRecord[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export type ClientPayload = {
  row_version?: number;
  name?: string;
  display_name?: string;
  company_name?: string;
  tax_id?: string;
  phone?: string;
  whatsapp_phone?: string;
  email?: string;
  country?: string;
  city?: string;
  address?: string;
  customer_type?: ClientCustomerType;
  lifecycle_status?: ClientLifecycleStatus;
  source?: ClientSource;
  preferred_language?: string;
  preferred_currency?: string;
  notes?: string;
  credit_enabled?: boolean;
  credit_limit?: number;
  payment_amount_due?: number;
  payment_amount_paid?: number;
  payment_currency?: string;
};

export async function listClients(params: {
  q?: string;
  status?: ClientLifecycleStatus | "";
  customer_type?: ClientCustomerType | "";
  source?: ClientSource | "";
  country?: string;
  city?: string;
  page?: number;
  page_size?: number;
  sort?: string;
} = {}) {
  return (await api.get<ClientsResponse>("/clients", { params })).data;
}

export async function getClient(id: string) {
  return (await api.get<{ status: "ok"; client: ClientRecord }>(`/clients/${id}`)).data.client;
}

export async function createClient(payload: ClientPayload) {
  return (await api.post<{ status: "ok"; client: ClientRecord }>("/clients", payload)).data.client;
}

export async function updateClient(id: string, payload: ClientPayload) {
  return (await api.patch<{ status: "ok"; client: ClientRecord }>(`/clients/${id}`, payload)).data.client;
}

export async function deleteClient(id: string, rowVersion: number) {
  return (await api.delete<{ status: "ok" }>(`/clients/${id}`, { params: { row_version: rowVersion } })).data;
}

export async function listArchivedClients(params: { q?: string; page?: number; page_size?: number } = {}) {
  return (await api.get<ClientsResponse>("/clients/archived", { params })).data;
}

export async function restoreClient(id: string, rowVersion: number) {
  return (await api.post<{ status: "ok"; client: ClientRecord }>(`/clients/${id}/restore`, null, { params: { row_version: rowVersion } })).data.client;
}

export async function mergeClients(payload: {
  source_client_id: string;
  target_client_id: string;
  source_version: number;
  target_version: number;
  idempotency_key: string;
}) {
  return (await api.post<{ status: "ok"; client: ClientRecord }>("/clients/merge", payload)).data.client;
}

export async function getClientStats() {
  return (await api.get<{ status: "ok"; stats: ClientStats }>("/clients/stats")).data.stats;
}

export async function getClientTimeline(id: string) {
  return (await api.get<{ status: "ok"; items: ClientTimelineEvent[] }>(`/clients/${id}/timeline`)).data.items;
}

export async function getClientWorkspace(id: string) {
  return (await api.get<{ status: "ok"; workspace: ClientWorkspace }>(`/clients/${id}/workspace`)).data.workspace;
}

export async function findClientDuplicates(params: {
  client_id?: string;
  phone?: string;
  email?: string;
  name?: string;
}) {
  return (await api.get<{ status: "ok"; items: ClientDuplicate[] }>("/clients/duplicates", { params })).data.items;
}

export async function importClients(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return (
    await api.post<{ status: "ok"; result: ClientImportResult }>("/clients/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data.result;
}

export async function exportClients(params: {
  q?: string;
  status?: ClientLifecycleStatus | "";
  customer_type?: ClientCustomerType | "";
  source?: ClientSource | "";
  country?: string;
  city?: string;
  sort?: string;
} = {}) {
  return (
    await api.get<Blob>("/clients/export", {
      params,
      responseType: "blob",
    })
  ).data;
}
