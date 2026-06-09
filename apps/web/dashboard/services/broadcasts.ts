import { api } from "@/services/api";

import type {
  BroadcastCampaign,
} from "@/types/broadcasts";

export async function getBroadcasts(): Promise<BroadcastCampaign[]> {
  const response = await api.get("/broadcasts");

  return response.data.campaigns;
}

export async function createBroadcast(data: {
  title: string;
  message_body: string;
  audience_type: string;
}) {
  const response = await api.post("/broadcasts", data);

  return response.data;
}