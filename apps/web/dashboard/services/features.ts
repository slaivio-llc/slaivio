import { api } from "@/services/api";

export async function getFeatures() {
  const response = await api.get("/features");

  return response.data.features;
}

export async function setFeatureFlag(data: {
  flag_key: string;
  enabled: boolean;
  rollout_percentage?: number;
}) {
  const response = await api.post("/features/set", data);

  return response.data.feature;
}

