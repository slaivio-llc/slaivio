import { api } from "@/services/api";

export type DashboardMetric = {
  value: number;
  delta?: number;
  currency?: string;
};

export type DashboardOverview = {
  status: "ok";
  workspace: {
    org_id?: string | null;
    name: string;
    country?: string | null;
  };
  manager: {
    name: string;
    initials: string;
  };
  stats: {
    active_clients: DashboardMetric;
    transit_packages: DashboardMetric;
    active_shipments: DashboardMetric;
    monthly_revenue: DashboardMetric;
  };
  shipment_trends: Array<{
    label: string;
    shipments: number;
    deliveries: number;
  }>;
  status_breakdown: Array<{
    status: string;
    value: number;
  }>;
  recent_shipments: Array<{
    reference: string;
    client_name: string;
    origin?: string | null;
    destination?: string | null;
    status: string;
    updated_at?: string | null;
  }>;
  whatsapp_preview: {
    unread_count: number;
    conversations: Array<{
      name: string;
      preview: string;
      phone?: string | null;
      created_at?: string | null;
    }>;
  };
  notifications: Array<{
    title: string;
    message: string;
    status?: string | null;
    created_at?: string | null;
  }>;
  empty: boolean;
};

export async function getDashboardOverview() {
  const { data } = await api.get<DashboardOverview>("/dashboard/overview");
  return data;
}
