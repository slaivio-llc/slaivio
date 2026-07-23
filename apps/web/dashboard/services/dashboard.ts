import { api } from "@/services/api";

export type HomeResource = {
  key: string;
  name: string;
  description: string;
  href: string;
  tone: string;
  is_starred: boolean;
  last_opened_at?: string | null;
};

export type HomeNotification = {
  id: string;
  title: string;
  message: string;
  event_type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
};

export type DashboardHome = {
  status: "ok";
  workspace: { org_id?: string | null; name: string };
  manager: { name: string; email: string; initials: string };
  resources: HomeResource[];
  notifications: HomeNotification[];
  unread_count: number;
};

export type HomeSearchResult = {
  kind: "client" | "shipment" | "dossier";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function getDashboardHome() {
  return (await api.get<DashboardHome>("/dashboard/home")).data;
}

export async function updateHomeResource(key: string, body: { is_starred?: boolean; opened?: boolean }) {
  return (await api.patch(`/dashboard/home/resources/${key}`, body)).data;
}

export async function searchDashboardHome(query: string, signal?: AbortSignal) {
  return (await api.get<{ results: HomeSearchResult[] }>("/dashboard/home/search", { params: { q: query }, signal })).data.results;
}

export async function markHomeNotificationRead(id: string) {
  return (await api.patch(`/manager/events/${id}/read`)).data;
}
