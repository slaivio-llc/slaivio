import { api } from "@/services/api";

export type NetworkOffice = {
  org_id: string;
  organization_name: string;
  organization_code?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_current: boolean;
  package_count: number;
  in_transit_count: number;
  delivered_count: number;
};

export type OrganizationNetwork = {
  network: { group_id: string; name: string } | null;
  access: { network_role: string; access_scope: string } | null;
  offices: NetworkOffice[];
  summary: { offices: number; countries: number; packages?: number; in_transit?: number };
};

export type NetworkInvitation = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | string;
  created_at: string;
  accepted_at?: string | null;
  role_code: "MANAGER" | "OPERATOR" | "WAREHOUSE" | "SUPPORT" | "FINANCE";
  office_ids: string[];
  office_names: string[];
};

export async function getOrganizationNetwork() {
  return (await api.get<OrganizationNetwork>("/organization/network")).data;
}

export async function setupOrganizationNetwork(body: {
  network_name: string; country_code: string; country_name: string;
  currency_code: string; timezone: string;
}) {
  return (await api.post<OrganizationNetwork>("/organization/network/setup", body)).data;
}

export async function createNetworkOffice(body: {
  organization_name: string; office_code: string; country: string; country_code: string; city: string;
  currency_code: string; timezone: string; address?: string | null;
  phone?: string | null; email?: string | null;
}) {
  return (await api.post<OrganizationNetwork>("/organization/network/offices", body)).data;
}

export async function grantNetworkOffices(body: {
  user_id: string;
  office_ids: string[];
  role_code: "MANAGER" | "OPERATOR" | "WAREHOUSE" | "SUPPORT" | "FINANCE";
}) {
  return (await api.post<{ grant: typeof body }>("/organization/network/members/grant", body)).data;
}

export async function listNetworkInvitations() {
  return (await api.get<{ invitations: NetworkInvitation[] }>("/organization/network/invitations")).data.invitations;
}

export async function inviteNetworkMember(body: {
  email: string;
  office_ids: string[];
  role_code: NetworkInvitation["role_code"];
}) {
  return (await api.post<{ invitation: NetworkInvitation }>("/organization/network/invitations", body)).data;
}
