import { api } from "@/services/api";
import type { WhatsAppSettings } from "@/types/whatsapp-settings";

export async function getWhatsAppSettings(
  orgId: string
): Promise<WhatsAppSettings | null> {
  const response = await api.get(
    `/organization/${orgId}/whatsapp-settings`
  );

  return response.data.settings;
}

export async function saveWhatsAppSettings(data: {
  org_id: string;
  provider: string;
  environment: string;
  meta_phone_number_id?: string;
  meta_waba_id?: string;
  meta_whatsapp_display_phone?: string;
  meta_app_id?: string;
  sender_status?: string;
  sender_country?: string;
  default_language?: string;
  default_timezone?: string;
  is_active?: boolean;
}) {
  const response = await api.post(
    "/organization/whatsapp-settings",
    data
  );

  return response.data.settings;
}
