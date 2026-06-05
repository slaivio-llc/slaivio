import { api } from "@/services/api";

export async function getShipmentTimeline(shipmentId: string) {
  const response = await api.get(`/shipments/${shipmentId}/timeline`);
  return response.data;
}

export async function updateShipmentLifecycle(
  shipmentId: string,
  data: {
    status: string;
    event_message?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const response = await api.patch(
    `/shipments/${shipmentId}/lifecycle`,
    data
  );
  return response.data;
}

export async function confirmWarehouseReceipt(data: {
  shipment_id: string;
  warehouse_id: string;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  package_label?: string | null;
  package_condition?: string;
  measured_weight_kg?: number | null;
  measured_volume_cbm?: number | null;
  notes?: string | null;
}) {
  const response = await api.post("/warehouse/receipts", data);
  return response.data;
}

export async function getWarehouseReceipts(warehouseId?: string) {
  const response = await api.get("/warehouse/receipts", {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  });
  return response.data.receipts;
}

export async function createShipmentBatch(data: {
  batch_type: string;
  route_origin_country?: string | null;
  route_origin_city?: string | null;
  route_destination_country?: string | null;
  route_destination_city?: string | null;
  carrier_name?: string | null;
  carrier_reference?: string | null;
  eta_at?: string | null;
  notes?: string | null;
}) {
  const response = await api.post("/shipment-batches", data);
  return response.data.batch;
}

export async function getShipmentBatches() {
  const response = await api.get("/shipment-batches");
  return response.data.batches;
}

export async function addShipmentToBatch(
  batchId: string,
  shipmentId: string
) {
  const response = await api.post(
    `/shipment-batches/${batchId}/items`,
    { shipment_id: shipmentId }
  );
  return response.data.item;
}

export async function updateShipmentBatchStatus(
  batchId: string,
  status: string
) {
  const response = await api.patch(
    `/shipment-batches/${batchId}/status`,
    { status }
  );
  return response.data.batch;
}

export async function createBatchManifest(batchId: string) {
  const response = await api.post(`/manifests/batches/${batchId}`);
  return response.data.manifest;
}

export async function getManifests() {
  const response = await api.get("/manifests");
  return response.data.manifests;
}

export async function createCustomsCase(data: Record<string, unknown>) {
  const response = await api.post("/customs/cases", data);
  return response.data.case;
}

export async function getCustomsCases() {
  const response = await api.get("/customs/cases");
  return response.data.cases;
}

export async function updateShipmentEta(
  shipmentId: string,
  data: {
    eta_at: string;
    route_id?: string | null;
    delay_status?: string;
    delay_reason?: string | null;
  }
) {
  const response = await api.patch(
    `/routes-engine/shipments/${shipmentId}/eta`,
    data
  );
  return response.data.shipment;
}

export async function createPublicTrackingToken(shipmentId: string) {
  const response = await api.post(
    `/shipments/${shipmentId}/public-token`
  );
  return response.data;
}

export async function registerWarehouseScan(data: {
  shipment_ref: string;
  scan_type: string;
  barcode?: string | null;
  warehouse_id?: string | null;
  location_label?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await api.post("/warehouse/scans", data);
  return response.data.scan;
}

export async function getWarehouseInventory() {
  const response = await api.get("/warehouse/inventory");
  return response.data.inventory;
}

export async function createDeliveryJob(data: Record<string, unknown>) {
  const response = await api.post("/delivery/jobs", data);
  return response.data.job;
}

export async function getDeliveryJobs() {
  const response = await api.get("/delivery/jobs");
  return response.data.jobs;
}

