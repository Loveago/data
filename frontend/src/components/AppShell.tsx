"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, ready } = useAuth();

  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (!ready) return;

    if (!publicPath && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (publicPath && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, publicPath, ready, router]);

  if (publicPath) {
    return <div className="min-h-dvh bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">{children}</div>;
  }

  if (!ready || !isAuthenticated) {
    return (
      <div className="min-h-dvh bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Loading...
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
