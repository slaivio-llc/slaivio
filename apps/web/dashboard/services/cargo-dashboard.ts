import { api } from "@/services/api";

export type CargoQuery = { preset: string; comparison: string; scope: string; start?: string; end?: string; compare_start?: string; compare_end?: string; metric?: string; page?: string };
export type CargoParcel = { id: string; reference: string; status: string; destination_country: string | null; destination_city: string | null; href: string | null; reason?: string; org_id: string; eta_at?: string | null };
export type CargoDashboardData = {
  workspace: { id: string; name: string; country: string | null; city: string | null; group_id: string | null };
  scope: string; office_count: number; generated_at: string;
  period: { timezone: string; current: { start: string; end: string }; previous: { start: string; end: string } | null };
  flows: Record<"received" | "shipped" | "delivered", number>;
  previous_flows: Record<"received" | "shipped" | "delivered", number> | null;
  states: Record<"in_transit" | "ready_for_pickup" | "blocked" | "warehoused", number>;
  attention: CargoParcel[]; recent: CargoParcel[];
  trend?: {day:string;received:number}[];
  finance?: {scope:'office';org_id:string;currencies:{currency:string;collected:string;outstanding:string;overdue:string}[]} | null;
  upcoming?: CargoParcel[];
  departures?: {id:string;org_id:string;departure_code:string;scheduled_at:string;cutoff_at:string|null;status:string}[] | null;
  drilldown?: {metric:string;page:number;page_size:number;total:number;items:CargoParcel[]} | null;
  destinations: { country: string | null; city: string | null; received: number; delivered: number }[];
};
export async function getCargoDashboard(query: CargoQuery, signal: AbortSignal) {
  return (await api.get<CargoDashboardData>("/dashboard/cargo", { params: query, signal })).data;
}
