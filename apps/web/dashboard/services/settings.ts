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
