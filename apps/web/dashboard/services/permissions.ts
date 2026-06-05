import { api } from "@/services/api";

export async function getMyPermissions() {
  const response = await api.get("/me/permissions");

  return response.data;
}

