import { usePermissions } from "@/components/permissions/permission-provider";

export function usePermission(permission: string) {
  const { permissions, loading } = usePermissions();

  return {
    loading,
    allowed: permissions.includes(permission),
  };
}

