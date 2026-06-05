import axios from "axios";

export const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    let token = localStorage.getItem("slaivo_token");

    const clerk = (window as any).Clerk;

    if (clerk?.session?.getToken) {
      token = await clerk.session.getToken();
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});
