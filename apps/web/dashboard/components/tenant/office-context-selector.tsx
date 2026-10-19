"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { ChevronDown } from "lucide-react";
import {
  getOfficeContext,
  setOfficeContext,
  type OfficeContext,
} from "@/services/organization-admin";
import { getTenantContext } from "@/services/tenant";

const storageKey = "slaivio:office-context";

export function OfficeContextSelector({ collapsed = false, compact = false }: { collapsed?: boolean; compact?: boolean }) {
  const [context, setContext] = useState<OfficeContext | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [activeOffice, setActiveOffice] = useState("");

  useEffect(() => {
    let active = true;
    getTenantContext()
      .then((tenant) => {
        if (!active) return;
        setActiveOffice(tenant.active_tenant?.city || tenant.active_tenant?.organization_name || "Mon bureau");
      })
      .catch(() => undefined);
    getOfficeContext()
      .then((result) => {
        if (!active) return;
        const stored = window.sessionStorage.getItem(storageKey) || "";
        const valid = result.offices.some((office) => office.location_id === stored);
        setContext(result);
        setSelected(valid ? stored : "");
        if (!valid) window.sessionStorage.removeItem(storageKey);
      })
      .catch(() => {
        if (active) setError("Contexte des bureaux indisponible.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function changeContext(value: string) {
    setError("");
    try {
      await setOfficeContext(value || null);
      if (value) window.sessionStorage.setItem(storageKey, value);
      else window.sessionStorage.removeItem(storageKey);
      setSelected(value);
    } catch {
      setError("Vous n’êtes pas autorisé à sélectionner ce bureau.");
    }
  }

  return (
    <div className={compact ? "min-w-0" : "mt-2"}>
      {!collapsed && !compact && (
        <label htmlFor="office-context" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7a8188]">
          Contexte de travail
        </label>
      )}
      {compact ? (
      <div className="relative min-w-0">
        <Building2 size={14} className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-[#555f68]" />
        {context?.offices.length ? <select
          id="office-context"
          aria-label="Bureau actif"
          className="h-9 w-full appearance-none rounded-full border border-[#d4d8da] bg-white pl-8 pr-7 text-[12px] font-medium text-[#41494f]"
          value={selected}
          onChange={(event) => changeContext(event.target.value)}
        >
          <option value="">{activeOffice || "Tous les bureaux"}</option>
          {context.offices.map((office) => <option key={office.location_id} value={office.location_id}>{office.city || office.name}</option>)}
        </select> : <div aria-label="Bureau actif" className="flex h-9 items-center truncate rounded-full border border-[#d4d8da] bg-white pl-8 pr-7 text-[12px] font-medium text-[#41494f]">{activeOffice || "Mon bureau"}</div>}
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#59636b]" />
      </div>
      ) : <div className="flex items-center gap-2">
        {collapsed && <Building2 size={15} className="shrink-0 text-[#667078]" />}
        <select
          id="office-context"
          aria-label="Contexte de travail"
          className="h-9 min-w-0 flex-1 rounded-[5px] border border-[#d8d9dc] bg-white px-2 text-[12px]"
          value={selected}
          onChange={(event) => changeContext(event.target.value)}
        >
          <option value="">Tous les bureaux autorisés</option>
          {(context?.offices || []).map((office) => (
            <option key={office.location_id} value={office.location_id}>
              {office.name} · {office.city}
            </option>
          ))}
        </select>
      </div>}
      {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
