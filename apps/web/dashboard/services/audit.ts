import { api } from "./api";

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  severity: string | null;
  created_at: string;
};

export async function getAuditLogs() {
  return (await api.get<{ logs: AuditLog[] }>("/audit/logs")).data.logs;
}
