"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { getMyPermissions } from "@/services/permissions";

const PermissionContext = createContext<any>(null);

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await getMyPermissions();
      setPermissions(data.permissions || []);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        reload: load,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error("PermissionProvider missing");
  }

  return context;
}

