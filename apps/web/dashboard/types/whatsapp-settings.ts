export type WhatsAppSettings = {
  id: string;
  org_id: string;

  provider: string;
  environment: string;

  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  meta_whatsapp_display_phone: string | null;
  meta_app_id: string | null;

  sender_status: string | null;
  sender_country: string | null;

  default_language: string | null;
  default_timezone: string | null;

  is_active: boolean;
};
