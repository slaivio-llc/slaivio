import { api } from "@/services/api";

import type {
  Shipment,
  ShipmentDetails,
} from "@/types/shipments";


export async function getShipments(): Promise<Shipment[]> {
  const response = await api.get("/shipments");

  return response.data.shipments;
}


export async function getShipment(
  shipmentId: string
): Promise<ShipmentDetails> {
  const response = await api.get(
    `/shipments/${shipmentId}`
  );

  return response.data;
}


export async function updateShipmentStatus(
  shipmentId: string,
  status: string,
  notes?: string
): Promise<Shipment> {
  const response = await api.patch(
    `/shipments/${shipmentId}/status`,
    {
      status,
      notes,
    }
  );

  return response.data.shipment;
}
