import { api } from "@/services/api";

import type {
  Dossier,
  DossierDetails,
} from "@/types/dossiers";

export async function getDossiers(): Promise<Dossier[]> {
  const response = await api.get("/dossiers");

  return response.data.dossiers;
}

export async function getDossier(
  dossierId: string
): Promise<DossierDetails> {
  const response = await api.get(`/dossiers/${dossierId}`);

  const payload = response.data.data || response.data;
  const client = payload.client || null;
  const dossier = {
    ...payload.dossier,
    client_phone: payload.dossier.client_phone || client?.phone || null,
    client_name: payload.dossier.client_name || client?.name || null,
    message_count: payload.messages?.length || 0,
  };

  return {
    dossier,
    client,
    messages: payload.messages || [],
    timeline: (payload.events || payload.timeline || []).map((event: any) => ({
      id: event.id,
      event_type: event.event_type,
      event_payload: event.event_payload ?? event.payload ?? {},
      created_at: event.created_at,
    })),
    notifications: payload.notifications || [],
  };
}
