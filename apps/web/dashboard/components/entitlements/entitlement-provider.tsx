"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { getEntitlements } from "@/services/entitlements";

const EntitlementContext = createContext<any>(null);

export function EntitlementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await getEntitlements();
      setPlanCode(data.plan_code);

      const map: Record<string, any> = {};

      data.entitlements.forEach((item: any) => {
        if (item.entitlement_type === "BOOLEAN") {
          map[item.entitlement_key] = item.boolean_value;
        }

        if (item.entitlement_type === "LIMIT") {
          map[item.entitlement_key] = item.limit_value;
        }
      });

      setEntitlements(map);
    } catch {
      setEntitlements({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <EntitlementContext.Provider
      value={{
        planCode,
        entitlements,
        loading,
        reload: load,
      }}
    >
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlements() {
  const context = useContext(EntitlementContext);

  if (!context) {
    throw new Error("EntitlementProvider missing");
  }

  return context;
}

