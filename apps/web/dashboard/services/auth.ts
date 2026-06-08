import { api } from "@/services/api";
import type { Manager } from "@/types/auth";

export async function getCurrentManager(): Promise<Manager> {
  const response = await api.get("/auth/me");

  return response.data.manager;
}
