import { api } from "@/services/api";

export async function getKnowledgeItems() {
  const response = await api.get("/settings/knowledge");
  return response.data.items;
}

export async function createKnowledgeItem(data: {
  title: string;
  content: string;
  category: string;
}) {
  const response = await api.post("/settings/knowledge", data);
  return response.data.item;
}

export async function getGoodsRules() {
  const response = await api.get("/settings/goods-rules");
  return response.data.rules;
}

export async function createGoodsRule(data: {
  goods_name: string;
  category: string;
  is_accepted: boolean;
  pricing_mode?: string;
  note?: string;
}) {
  const response = await api.post("/settings/goods-rules", data);
  return response.data.rule;
}

export async function getPricingRules() {
  const response = await api.get("/settings/pricing-rules");
  return response.data.rules;
}

export async function createPricingRule(data: {
  origin_country: string;
  destination_country: string;
  rule_type: string;
  price: number;
  currency: string;
  goods_type?: string;
}) {
  const response = await api.post("/settings/pricing-rules", data);
  return response.data.rule;
}

export type AISettings = {
  id?: string;
  org_id: string;
  enabled: boolean;
  provider: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  escalation_confidence: number;
  escalation_threshold: number;
  auto_escalation_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_min_confidence: number;
};

export type WhatsAppSenderStatus = {
  can_send: boolean;
  strategy: string | null;
  display_phone_number: string | null;
  phone_number_id: string | null;
  has_access_token: boolean;
};

export async function getAISettings(): Promise<{
  settings: AISettings;
  whatsapp_sender: WhatsAppSenderStatus;
}> {
  const response = await api.get("/settings/ai");

  return {
    settings: response.data.settings,
    whatsapp_sender: response.data.whatsapp_sender,
  };
}

export async function updateAISettings(data: {
  enabled?: boolean;
  auto_reply_enabled?: boolean;
  auto_reply_min_confidence?: number;
  escalation_threshold?: number;
}): Promise<{
  settings: AISettings;
  whatsapp_sender: WhatsAppSenderStatus;
}> {
  const response = await api.patch("/settings/ai", data);

  return {
    settings: response.data.settings,
    whatsapp_sender: response.data.whatsapp_sender,
  };
}
