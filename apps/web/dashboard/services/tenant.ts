import { api } from "@/services/api";

export async function getTenantContext() {
  const response = await api.get("/tenant/context");

  return response.data;
}

export async function switchTenant(orgId: string) {
  const response = await api.post("/tenant/switch", {
    org_id: orgId,
  });

  return response.data.active_tenant;
}

