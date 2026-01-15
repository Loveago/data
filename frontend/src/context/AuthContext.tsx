"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { clearAuth, loadAuth, saveAuth } from "@/lib/storage";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  ready: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSession: (payload: { user?: User | null; accessToken?: string | null; refreshToken?: string | null }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function setAuthCookie(authed: boolean) {
  if (typeof document === "undefined") return;
  if (authed) {
    document.cookie = "gigshub_authed=1; path=/; max-age=31536000; samesite=lax";
  } else {
    document.cookie = "gigshub_authed=; path=/; max-age=0; samesite=lax";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, refreshToken: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadAuth();
    setState(loaded);
    setReady(true);
  }, []);

  useEffect(() => {
    function sync() {
      setState(loadAuth());
      setReady(true);
    }

    window.addEventListener("gigshub_auth_updated", sync);
    return () => {
      window.removeEventListener("gigshub_auth_updated", sync);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveAuth(state);
  }, [ready, state]);

  useEffect(() => {
    if (!ready) return;
    setAuthCookie(Boolean(state.accessToken && state.user));
  }, [ready, state.accessToken, state.user]);

  const value = useMemo<AuthContextValue>(() => {
    const login: AuthContextValue["login"] = async ({ email, password }) => {
      const res = await api.post("/auth/login", { email, password });
      const data = res.data as { user: User; accessToken: string; refreshToken: string };
      setState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthCookie(true);
    };

    const register: AuthContextValue["register"] = async ({ email, password, name, phone }) => {
      const res = await api.post("/auth/register", { email, password, name, phone });
      const data = res.data as { user: User; accessToken: string; refreshToken: string };
      setState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthCookie(true);
    };

    const refresh: AuthContextValue["refresh"] = async () => {
      if (!state.refreshToken) return;
      const res = await api.post("/auth/refresh", { refreshToken: state.refreshToken });
      const data = res.data as { accessToken: string; refreshToken: string };
      setState((prev) => ({ ...prev, accessToken: data.accessToken, refreshToken: data.refreshToken }));
    };

    const logout: AuthContextValue["logout"] = async () => {
      try {
        if (state.refreshToken) {
          try {
            await api.post("/auth/logout", { refreshToken: state.refreshToken });
          } catch {
            void 0;
          }
        }
      } finally {
        clearAuth();
        setAuthCookie(false);
        setState({ user: null, accessToken: null, refreshToken: null });
      }
    };

    const updateSession: AuthContextValue["updateSession"] = ({ user, accessToken, refreshToken }) => {
      setState((prev) => ({
        user: user === undefined ? prev.user : user,
        accessToken: accessToken === undefined ? prev.accessToken : accessToken,
        refreshToken: refreshToken === undefined ? prev.refreshToken : refreshToken,
      }));
    };

    return {
      user: state.user,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      ready,
      isAuthenticated: Boolean(state.accessToken && state.user),
      login,
      register,
      logout,
      refresh,
      updateSession,
    };
  }, [ready, state.accessToken, state.refreshToken, state.user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
