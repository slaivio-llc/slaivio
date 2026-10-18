import { api } from "./api";

export type ParcelEntry = {
  id: string; org_id: string; reference: string | null; client_id: string | null;
  client_name: string | null; local_client: boolean; status: string; stage: string;
  status_label: string; service_name: string | null; office_name: string | null;
};
export type ParcelOverview = ParcelEntry & {
  row_version: number; weight_editable: boolean;
  public_tracking_enabled: boolean;
  supplier_tracking: string | null; external_reference: string | null; description: string | null;
  weight_kg: number | null; warehouse_location: string | null; warehouse_zone: string | null; warehouse_rack: string | null;
  destination_city: string | null; destination_country: string | null; route_name: string | null;
  received_at: string | null; dispatched_at: string | null; delivered_at: string | null; created_at: string; shipment_id: string | null; shipment_reference: string | null;
};
export type RegisterResult = { items: ParcelEntry[]; total: number; page: number; total_pages: number };
export type ParcelHistoryResult = { items: { id: string; title: string; description: string | null; previous_status?: string | null; new_status?: string | null; created_at: string }[]; total_pages: number; page: number };
export async function getParcelOverview(id: string) {
  return (await api.get<ParcelOverview>(`/packages/register/${id}`)).data;
}
