import type { CartItem, User } from "./types";

const AUTH_KEY = "gigshub_auth";
const CART_KEY = "gigshub_cart";

export type StoredAuth = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
};

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadAuth(): StoredAuth {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null, refreshToken: null };
  }
  const parsed = safeParse<StoredAuth>(window.localStorage.getItem(AUTH_KEY));
  return (
    parsed || {
      user: null,
      accessToken: null,
      refreshToken: null,
    }
  );
}

export function saveAuth(auth: StoredAuth) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event("gigshub_auth_updated"));
}

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<CartItem[]>(window.localStorage.getItem(CART_KEY));
  return parsed || [];
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function getAccessToken(): string | null {
  return loadAuth().accessToken;
}

export function getRefreshToken(): string | null {
  return loadAuth().refreshToken;
}

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string }) {
  const prev = loadAuth();
  saveAuth({ ...prev, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gigshub_auth_updated"));
  }
}
