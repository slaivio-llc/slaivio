"use client";

import { useEffect, useState } from "react";

import {
  getTenantContext,
  switchTenant,
} from "@/services/tenant";

export function OrganizationSwitcher() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [activeTenant, setActiveTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await getTenantContext();
      setTenants(data.tenants || []);
      setActiveTenant(data.active_tenant || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSwitch(orgId: string) {
    const active = await switchTenant(orgId);
    setActiveTenant(active);
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-500">
        Chargement organisation...
      </div>
    );
  }

  if (!tenants.length) {
    return (
      <div className="rounded-xl border p-3 text-xs text-gray-500">
        Aucune organisation active.
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-gray-500">
        Organisation active
      </div>

      <select
        value={activeTenant?.org_id || ""}
        onChange={(event) => handleSwitch(event.target.value)}
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
      >
        {tenants.map((tenant) => (
          <option key={tenant.org_id} value={tenant.org_id}>
            {tenant.organization_name} - {tenant.role_code}
          </option>
        ))}
      </select>
    </div>
  );
}

