import { api } from "@/services/api";
import type { LoginResponse, Manager } from "@/types/auth";

export async function loginManager(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });

  return response.data;
}

export async function getCurrentManager(): Promise<Manager> {
  const response = await api.get("/auth/me");

  return response.data.manager;
}