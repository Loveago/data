"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggle: () => void;
};

const THEME_KEY = "gigshub_theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const shouldDark = mode === "dark" || (mode === "system" && getSystemPrefersDark());
  root.classList.toggle("dark", shouldDark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    applyTheme(theme);
    window.localStorage.setItem(THEME_KEY, theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      if (theme === "system") applyTheme("system");
    }

    media.addEventListener?.("change", onChange);
    return () => {
      media.removeEventListener?.("change", onChange);
    };
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => {
    const setTheme = (mode: ThemeMode) => setThemeState(mode);
    const toggle = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
    return { theme, setTheme, toggle };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
