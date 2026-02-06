"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}

function IconButton({
  title,
  children,
  onClick,
}: {
  title: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  createdAt: string;
};

function TabIcon({ name, active }: { name: "home" | "store" | "cart" | "user"; active: boolean }) {
  const cls = active ? "text-blue-600 dark:text-blue-300" : "text-zinc-500 dark:text-zinc-400";
  if (name === "home") {
    return (
      <svg className={`h-5 w-5 ${cls}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "store") {
    return (
      <svg className={`h-5 w-5 ${cls}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 7h16l-1 13H5L4 7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "cart") {
    return (
      <svg className={`h-5 w-5 ${cls}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M6 6h15l-2 9H7L6 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6 6L5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
        <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={`h-5 w-5 ${cls}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function MobileTabLink({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: "home" | "store" | "cart" | "user";
  active: boolean;
  badge?: number;
}) {
  return (
    <Link href={href} className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2">
      <div className="relative">
        <TabIcon name={icon} active={active} />
        {badge && badge > 0 ? (
          <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={`text-[11px] font-semibold ${active ? "text-blue-600 dark:text-blue-300" : "text-zinc-500 dark:text-zinc-400"}`}>{label}</div>
    </Link>
  );
}

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { count } = useCart();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [notifClearedAt, setNotifClearedAt] = useState<string | null>(null);
  const notifDesktopRef = useRef<HTMLDivElement | null>(null);
  const notifMobileRef = useRef<HTMLDivElement | null>(null);
  const notifReqVersion = useRef(0);

  const themeLabel = theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";
  function cycleTheme() {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  }

  const joinCommunityHref = "https://chat.whatsapp.com/DU930JTfukeH4aDoDq2et4";
  const dashboardHref = user?.role === "ADMIN" ? "/admin" : "/dashboard";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const unreadCount = useMemo(() => {
    const clearedMs = notifClearedAt ? new Date(notifClearedAt).getTime() : 0;
    return notifItems.filter((n) => new Date(n.createdAt).getTime() > clearedMs).length;
  }, [notifClearedAt, notifItems]);

  const visibleNotifItems = useMemo(() => {
    const clearedMs = notifClearedAt ? new Date(notifClearedAt).getTime() : 0;
    return notifItems.filter((n) => new Date(n.createdAt).getTime() > clearedMs);
  }, [notifClearedAt, notifItems]);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    const myVersion = ++notifReqVersion.current;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await api.get<{ items: NotificationItem[]; clearedAt: string | null }>("/notifications", {
        params: { limit: 30 },
      });
      if (myVersion !== notifReqVersion.current) return;
      setNotifItems(res.data.items || []);
      setNotifClearedAt(res.data.clearedAt);
    } catch {
      if (myVersion !== notifReqVersion.current) return;
      setNotifError("Failed to load notifications.");
    } finally {
      if (myVersion !== notifReqVersion.current) return;
      setNotifLoading(false);
    }
  }, [isAuthenticated]);

  async function clearNotifications() {
    if (!isAuthenticated) return;
    const myVersion = ++notifReqVersion.current;
    setNotifError(null);
    try {
      const res = await api.post<{ ok: true; clearedAt: string }>("/notifications/clear");
      if (myVersion !== notifReqVersion.current) return;
      setNotifClearedAt(res.data.clearedAt);
      setNotifOpen(true);
    } catch {
      if (myVersion !== notifReqVersion.current) return;
      setNotifError("Failed to clear notifications.");
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifOpen(false);
      setNotifItems([]);
      setNotifClearedAt(null);
      return;
    }
    void loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!notifOpen) return;
      if (!(e.target instanceof Node)) return;
      const desktopEl = notifDesktopRef.current;
      const mobileEl = notifMobileRef.current;

      if (desktopEl && desktopEl.contains(e.target)) return;
      if (mobileEl && mobileEl.contains(e.target)) return;

      setNotifOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [notifOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="hidden items-center justify-between rounded-full border border-zinc-200 bg-white/80 px-3 py-2 shadow-soft backdrop-blur dark:border-zinc-800 dark:bg-black/50 md:flex">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 rounded-full px-2 py-1">
                <img src="/lofaq-techub.svg" alt="LOFAQ DATA HUB" className="h-8 w-auto" />
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/store">Stores</NavLink>
                <NavLink href="/cart">Cart ({count})</NavLink>
                {user?.role === "ADMIN" ? <NavLink href="/admin">Agent Dashboard</NavLink> : null}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <IconButton title="Search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 18C14.6421 18 18 14.6421 18 10.5C18 6.35786 14.6421 3 10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18Z" stroke="currentColor" strokeWidth="2" />
                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </IconButton>
                <div className="relative" ref={notifDesktopRef}>
                  <div className="relative">
                    <IconButton
                      title="Notifications"
                      onClick={() => {
                        const next = !notifOpen;
                        setNotifOpen(next);
                        if (next) void loadNotifications();
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 8A6 6 0 1 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="M13.73 21C13.5542 21.3031 13.3011 21.5547 12.9972 21.7295C12.6933 21.9044 12.349 21.9965 11.9985 21.9965C11.648 21.9965 11.3037 21.9044 10.9998 21.7295C10.6959 21.5547 10.4428 21.3031 10.267 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </IconButton>
                    {isAuthenticated && unreadCount > 0 ? (
                      <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    ) : null}
                  </div>

                  {notifOpen ? (
                    <div className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                        <div className="text-sm font-semibold">Notifications</div>
                        <button
                          type="button"
                          onClick={() => void clearNotifications()}
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="max-h-[360px] overflow-y-auto">
                        {notifLoading ? (
                          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
                        ) : notifError ? (
                          <div className="p-4 text-sm text-red-700 dark:text-red-300">{notifError}</div>
                        ) : visibleNotifItems.length === 0 ? (
                          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">No notifications.</div>
                        ) : (
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                            {visibleNotifItems.map((n) => {
                              const clearedMs = notifClearedAt ? new Date(notifClearedAt).getTime() : 0;
                              const isUnread = new Date(n.createdAt).getTime() > clearedMs;
                              return (
                                <div key={n.id} className="px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        {isUnread ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{n.title}</div>
                                      </div>
                                      <div
                                        className="mt-1 text-xs text-zinc-600 dark:text-zinc-300"
                                        dangerouslySetInnerHTML={{ __html: n.body }}
                                      />
                                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(n.createdAt).toLocaleString()}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={cycleTheme}
                  title={`Theme: ${themeLabel} (click to switch)`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {theme === "dark" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 20v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M4.93 4.93l1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M17.66 17.66l1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M2 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M20 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M4.93 19.07l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : theme === "light" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>

              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="hidden rounded-full bg-white px-3 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900 sm:block"
                  >
                    {user?.email}
                  </Link>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-800 dark:hover:bg-zinc-900"
                >
                  Login
                </Link>
              )}

              <a
                href={joinCommunityHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Join Community
              </a>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-full border border-zinc-200 bg-white/80 px-3 py-2 shadow-soft backdrop-blur dark:border-zinc-800 dark:bg-black/50 md:hidden">
            <Link href="/" className="flex items-center gap-2 rounded-full px-2 py-1">
              <img src="/lofaq-techub.svg" alt="LOFAQ DATA HUB" className="h-8 w-auto" />
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleTheme}
                title={`Theme: ${themeLabel}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {theme === "dark" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                ) : theme === "light" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>

              <div className="relative" ref={notifMobileRef}>
                <div className="relative">
                  <IconButton
                    title="Notifications"
                    onClick={() => {
                      const next = !notifOpen;
                      setNotifOpen(next);
                      if (next) void loadNotifications();
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 8A6 6 0 1 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M13.73 21C13.5542 21.3031 13.3011 21.5547 12.9972 21.7295C12.6933 21.9044 12.349 21.9965 11.9985 21.9965C11.648 21.9965 11.3037 21.9044 10.9998 21.7295C10.6959 21.5547 10.4428 21.3031 10.267 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </IconButton>
                  {isAuthenticated && unreadCount > 0 ? (
                    <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </div>

                {notifOpen ? (
                  <div className="fixed left-1/2 top-16 z-50 w-[min(92vw,360px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <div className="text-sm font-semibold">Notifications</div>
                      <button
                        type="button"
                        onClick={() => void clearNotifications()}
                        className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                      {notifLoading ? (
                        <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
                      ) : notifError ? (
                        <div className="p-4 text-sm text-red-700 dark:text-red-300">{notifError}</div>
                      ) : visibleNotifItems.length === 0 ? (
                        <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">No notifications.</div>
                      ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                          {visibleNotifItems.map((n) => {
                            const clearedMs = notifClearedAt ? new Date(notifClearedAt).getTime() : 0;
                            const isUnread = new Date(n.createdAt).getTime() > clearedMs;
                            return (
                              <div key={n.id} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isUnread ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                                  <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{n.title}</div>
                                </div>
                                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: n.body }} />
                                <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(n.createdAt).toLocaleString()}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <a
                href={joinCommunityHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Join
              </a>

              <Link
                href={isAuthenticated ? dashboardHref : "/login"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                title={isAuthenticated ? "Dashboard" : "Login"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="2" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:hidden">
        <div className="mx-auto max-w-md rounded-3xl border border-zinc-200 bg-white/90 shadow-soft backdrop-blur dark:border-zinc-800 dark:bg-black/60">
          <div className="flex items-center">
            <MobileTabLink href="/" label="Home" icon="home" active={isActive("/")} />
            <MobileTabLink href="/store" label="Store" icon="store" active={isActive("/store")} />
            <MobileTabLink href="/cart" label="Cart" icon="cart" active={isActive("/cart")} badge={count} />
            <MobileTabLink href={dashboardHref} label="User" icon="user" active={isActive(dashboardHref)} />
          </div>
        </div>
      </div>
    </>
  );
}
