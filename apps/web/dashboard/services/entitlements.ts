import { api } from "@/services/api";

export async function getEntitlements() {
  const response = await api.get("/entitlements");

  return response.data;
}

