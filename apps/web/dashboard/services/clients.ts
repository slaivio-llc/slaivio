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
  dossiers_count: number;
  shipments_count: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
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
};

export async function listClients(params: {
  q?: string;
  status?: ClientLifecycleStatus | "";
  customer_type?: ClientCustomerType | "";
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

export async function deleteClient(id: string) {
  return (await api.delete<{ status: "ok" }>(`/clients/${id}`)).data;
}

export async function getClientStats() {
  return (await api.get<{ status: "ok"; stats: ClientStats }>("/clients/stats")).data.stats;
}
