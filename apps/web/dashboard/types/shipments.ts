export type Shipment = {
  id: string;
  org_id: string;
  client_id: string | null;
  dossier_id: string | null;

  tracking_id: string | null;
  status: string;
  current_status?: string | null;
  eta_at?: string | null;
  current_batch_id?: string | null;
  batch_status?: string | null;
  customs_status?: string | null;
  delay_status?: string | null;
  inventory_status?: string | null;
  delivery_status?: string | null;
  final_release_status?: string | null;

  origin_country: string | null;
  origin_city: string | null;
  destination_country: string | null;
  destination_city: string | null;

  goods_type: string | null;

  estimated_weight_kg: number | null;
  actual_weight_kg: number | null;
  estimated_volume_cbm: number | null;
  actual_volume_cbm: number | null;

  final_total: number | null;
  final_currency: string | null;

  client_phone: string | null;
  client_name: string | null;
  case_type: string | null;
  dossier_status: string | null;

  created_at: string;
  updated_at: string;
};

export type ShipmentTimelineEvent = {
  id: string;
  event_type: string;
  event_payload: unknown;
  created_at: string;
};

export type ShipmentMedia = {
  id: string;
  media_type: string | null;
  media_url: string | null;
  caption: string | null;
  content_type: string | null;
  created_at: string;
};

export type ShipmentDetails = {
  shipment: Shipment;
  timeline: ShipmentTimelineEvent[];
  media: ShipmentMedia[];
};
