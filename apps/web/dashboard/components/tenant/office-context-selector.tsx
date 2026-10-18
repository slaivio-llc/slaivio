"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import {
  getOfficeContext,
  setOfficeContext,
  type OfficeContext,
} from "@/services/organization-admin";

const storageKey = "slaivio:office-context";

export function OfficeContextSelector({ collapsed = false, compact = false }: { collapsed?: boolean; compact?: boolean }) {
  const [context, setContext] = useState<OfficeContext | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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

  if (!context?.offices.length) return null;

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
      <div className="flex items-center gap-2">
        {collapsed && <Building2 size={15} className="shrink-0 text-[#667078]" />}
        <select
          id="office-context"
          aria-label="Contexte de travail"
          className="h-9 min-w-0 flex-1 rounded-[5px] border border-[#d8d9dc] bg-white px-2 text-[12px]"
          value={selected}
          onChange={(event) => changeContext(event.target.value)}
        >
          <option value="">Tous les bureaux autorisés</option>
          {context.offices.map((office) => (
            <option key={office.location_id} value={office.location_id}>
              {office.name} · {office.city}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
