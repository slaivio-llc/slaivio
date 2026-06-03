import { api } from "@/services/api";
import type { AgentPresence } from "@/types/inbox";

export async function getPresence(): Promise<AgentPresence[]> {
  const response = await api.get("/presence");

  return response.data.agents;
}
