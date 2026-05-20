export type Manager = {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  manager: Manager;
};
