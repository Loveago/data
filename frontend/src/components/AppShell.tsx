"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";

const AUTH_PUBLIC_PATHS = new Set(["/login", "/register"]);
const PUBLIC_PREFIXES = ["/storefront"];

function isPublicPath(pathname: string) {
  if (AUTH_PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPublicPath(pathname: string) {
  return AUTH_PUBLIC_PATHS.has(pathname);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, ready } = useAuth();

  const publicPath = isPublicPath(pathname);
  const authPublicPath = isAuthPublicPath(pathname);

  useEffect(() => {
    if (!ready) return;

    if (!publicPath && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (authPublicPath && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authPublicPath, isAuthenticated, publicPath, ready, router]);

  if (publicPath) {
    return <div className="min-h-dvh bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">{children}</div>;
  }

  if (!ready || !isAuthenticated) {
    return (
      <div className="relative overflow-hidden min-h-dvh bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70 dark:opacity-[0.18]" />
        <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />
        <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-600/25 via-cyan-500/20 to-emerald-400/15 blur-3xl animate-floaty" />
        <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/20 via-blue-500/16 to-cyan-400/12 blur-3xl animate-floaty2" />

        <div className="flex flex-col items-center justify-center min-h-dvh px-4">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200/70 bg-white/80 p-8 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 animate-fade-up">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 h-12 w-12 rounded-full border-[3px] border-t-transparent border-b-transparent border-l-blue-600/30 border-r-cyan-500/30 animate-spin" />
              <div className="absolute inset-0 h-12 w-12 rounded-full border-[3px] border-t-transparent border-b-transparent border-l-blue-600 border-r-cyan-500 animate-spin" style={{ animationDirection: 'reverse' }} />
            </div>
            <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">
      <Navbar />
      <main className="pb-24 md:pb-0">{children}</main>
      <Footer />
    </div>
  );
}
