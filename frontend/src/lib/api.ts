import axios, { AxiosHeaders } from "axios";

import { clearAuth, getAccessToken, getRefreshToken, setAuthTokens } from "./storage";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/api/auth/refresh`, { refreshToken }, { headers: { "Content-Type": "application/json" } })
      .then((res) => {
        const data = res.data as { accessToken: string; refreshToken: string };
        setAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return data.accessToken;
      })
      .catch(() => {
        clearAuth();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;

    if (status === 401 && original && !(original as any)._retry) {
      (original as any)._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        const headers = AxiosHeaders.from(original.headers || {});
        headers.set("Authorization", `Bearer ${newToken}`);
        original.headers = headers;
        return api.request(original);
      }
    }

    return Promise.reject(error);
  }
);
