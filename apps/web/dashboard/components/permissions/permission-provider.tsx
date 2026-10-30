"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { getMyPermissions } from "@/services/permissions";

type PermissionContextValue = {
  permissions: string[];
  loading: boolean;
  available: boolean;
  reload: () => Promise<void>;
  roleCode?:string;
  orgId?:string;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [roleCode,setRoleCode]=useState<string|undefined>(),[orgId,setOrgId]=useState<string|undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyPermissions();
      setPermissions(data.permissions || []);
      setAvailable(true);
      setRoleCode(data.role_code);setOrgId(data.org_id);
    } catch {
      setPermissions([]);
      setAvailable(false);
      setRoleCode(undefined);setOrgId(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        available,
        reload: load,
        roleCode,orgId,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);

  if (!context) {
    // Return default context for SSR to prevent build errors
    if (typeof window === 'undefined') {
      return {
        permissions: [],
        loading: true,
        available: false,
        reload: async () => {},
      };
    }
    throw new Error("PermissionProvider missing");
  }

  return context;
}

