export type Manager = {
  id: string;
  user_id?: string;
  org_id: string;
  tenant_org_id?: string;
  clerk_org_id?: string | null;
  name?: string | null;
  full_name: string;
  email: string;
  role: string;
};
