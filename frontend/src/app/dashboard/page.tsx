"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/lib/types";

type Order = {
  id: string;
  orderCode?: string | null;
  status: string;
  total: string;
  createdAt: string;
  items: { id: string; quantity: number; recipientPhone?: string | null; product: { name: string } }[];
};

function formatOrderLabel(orderCode?: string | null, id?: string) {
  if (orderCode) return orderCode;
  return id ? `#${id}` : "#";
}

function formatMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function displayName(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes("@")) return email.split("@")[0];
  return "there";
}

function statusPill(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (s === "PROCESSING") return "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
}

function statusLabel(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return "delivered";
  if (s === "PROCESSING") return "processing";
  return "pending";
}

function inferProviderFromProductName(name: string | undefined | null) {
  const n = String(name || "").toUpperCase();
  if (n.includes("AIRTEL")) return "AIRTEL";
  if (n.includes("TIGO")) return "TIGO";
  if (n.includes("VODAFONE")) return "VODAFONE";
  if (n.includes("MTN")) return "MTN";
  return "-";
}

type DashboardTab = "overview" | "profile" | "wallet" | "orders" | "settings";

function normalizeTab(value: string | null): DashboardTab {
  const v = String(value || "").toLowerCase();
  if (v === "profile" || v === "wallet" || v === "orders" || v === "settings") return v;
  return "overview";
}

function tabLabel(tab: DashboardTab) {
  if (tab === "profile") return "Profile";
  if (tab === "wallet") return "Wallet";
  if (tab === "orders") return "Orders";
  if (tab === "settings") return "Settings";
  return "Overview";
}

function tabIcon(tab: DashboardTab) {
  const common = "h-5 w-5";
  if (tab === "profile") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path
          d="M20 21a8 8 0 10-16 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 11a4 4 0 100-8 4 4 0 000 8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tab === "wallet") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path
          d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3V7z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M17 12h4v4h-4a2 2 0 110-4z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }
  if (tab === "orders") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path
          d="M7 7h14M7 12h14M7 17h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M3 7h.01M3 12h.01M3 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (tab === "settings") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path
          d="M12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M19.4 15a7.98 7.98 0 000-6l-2.1 1.2a6.02 6.02 0 00-1.3-1.3L17.2 6.8a7.98 7.98 0 00-6-2.4l.1 2.4a6.02 6.02 0 00-1.8.5L8.3 5.2a7.98 7.98 0 00-4.2 4.2l2.1 1.2a6.02 6.02 0 00-.5 1.8l-2.4-.1a7.98 7.98 0 002.4 6l1.2-2.1c.4.5.8 1 1.3 1.3l-1.2 2.1a7.98 7.98 0 006 2.4l-.1-2.4c.6-.1 1.2-.3 1.8-.5l1.2 2.1a7.98 7.98 0 004.2-4.2l-2.1-1.2c.2-.6.4-1.2.5-1.8l2.4.1z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function DashboardInner() {
  const { user, isAuthenticated, logout, updateSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recentOrder = searchParams.get("order");
  const agentUpgradeStatus = searchParams.get("agentUpgrade");

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normalizeTab(searchParams.get("tab")));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("gigshub_dashboard_sidebar_collapsed") === "1";
  });

  const [walletBalance, setWalletBalance] = useState<string>(user?.walletBalance || "0");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositFee, setDepositFee] = useState<number>(0);
  const [depositTotal, setDepositTotal] = useState<number>(0);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const isAgent = user?.role === "AGENT";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState("");

  const filteredOrders = useMemo(() => {
    if (!orderSearch) return orders;
    const q = orderSearch.toLowerCase();
    return orders.filter((o) => {
      const firstItem = o.items?.[0];
      const recipient = firstItem?.recipientPhone || "";
      const productName = firstItem?.product?.name || "";
      const provider = inferProviderFromProductName(productName);
      const status = String(o.status);
      return (
        o.id.toLowerCase().includes(q) ||
        recipient.toLowerCase().includes(q) ||
        productName.toLowerCase().includes(q) ||
        provider.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch]);
  const displayOrders = activeTab === "orders" ? filteredOrders : orders;
  const tableOrders = activeTab === "orders" ? displayOrders : displayOrders.slice(0, 6);
  const [profileName, setProfileName] = useState<string>(user?.name || "");
  const [profilePhone, setProfilePhone] = useState<string>(user?.phone || "");
  const [profileEmail, setProfileEmail] = useState<string>(user?.email || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    setProfileName(user?.name || "");
    setProfilePhone(user?.phone || "");
    setProfileEmail(user?.email || "");
  }, [user?.email, user?.name, user?.phone]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("gigshub_dashboard_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  function pushTab(next: DashboardTab) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", next);
    router.push(`/dashboard?${sp.toString()}`);
  }

  async function saveProfile() {
    setProfileBusy(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const res = await api.patch("/auth/me", {
        name: profileName,
        phone: profilePhone,
        email: profileEmail,
      });
      const data = res.data as { user: User; accessToken?: string; refreshToken?: string };
      updateSession({
        user: data.user,
        accessToken: data.accessToken ?? undefined,
        refreshToken: data.refreshToken ?? undefined,
      });
      setProfileSuccess("Profile updated successfully.");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setProfileError(maybeError?.response?.data?.error || "Failed to update profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword() {
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      if (!currentPassword || !newPassword) {
        setPasswordError("Enter your current password and a new password.");
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError("New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }

      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      const data = res.data as { user: User; accessToken?: string; refreshToken?: string };
      updateSession({
        user: data.user,
        accessToken: data.accessToken ?? undefined,
        refreshToken: data.refreshToken ?? undefined,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password changed successfully.");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setPasswordError(maybeError?.response?.data?.error || "Failed to change password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isAuthenticated) {
        setOrders([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get<{ items: Order[] }>("/orders/my");
        if (!cancelled) setOrders(res.data.items || []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      if (!isAuthenticated) return;
      try {
        const res = await api.get<{ walletBalance: string }>("/wallet/me");
        if (!cancelled) setWalletBalance(res.data.walletBalance || "0");
      } catch {
        if (!cancelled) setWalletBalance(user?.walletBalance || "0");
      }
    }

    loadWallet();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.walletBalance]);

  useEffect(() => {
    let cancelled = false;
    const amount = Number(depositAmount);

    async function loadDepositQuote() {
      try {
        const res = await api.post<{ amount: number; fee: string; total: string }>("/wallet/deposit/paystack/quote", { amount });
        if (cancelled) return;
        const fee = Number(res.data?.fee);
        const total = Number(res.data?.total);
        setDepositFee(Number.isFinite(fee) ? fee : 0);
        setDepositTotal(Number.isFinite(total) ? total : 0);
      } catch {
        if (cancelled) return;
        setDepositFee(0);
        setDepositTotal(0);
      }
    }

    if (isAuthenticated && Number.isFinite(amount) && amount > 0) {
      const t = window.setTimeout(() => {
        loadDepositQuote();
      }, 300);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    setDepositFee(0);
    setDepositTotal(0);
    return () => {
      cancelled = true;
    };
  }, [depositAmount, isAuthenticated]);

  async function depositWithPaystack() {
    setDepositBusy(true);
    setDepositError(null);
    try {
      const callbackUrl = `${window.location.origin}/dashboard/wallet/paystack`;
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setDepositError("Enter a valid amount.");
        return;
      }

      const res = await api.post("/wallet/deposit/paystack/initialize", {
        amount,
        email: user?.email,
        callbackUrl,
      });

      const authorizationUrl = res.data?.authorizationUrl;
      const reference = res.data?.reference;
      if (!authorizationUrl) throw new Error("Missing authorizationUrl");

      const fee = Number(res.data?.fee);
      const total = Number(res.data?.total);

      if (reference) {
        window.sessionStorage.setItem(
          "gigshub_wallet_deposit_pending",
          JSON.stringify({
            reference,
            amount,
            fee: Number.isFinite(fee) ? fee : undefined,
            total: Number.isFinite(total) ? total : undefined,
          })
        );
      }

      window.location.href = authorizationUrl;
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setDepositError(maybeError?.response?.data?.error || "Failed to start deposit.");
    } finally {
      setDepositBusy(false);
    }
  }

  async function upgradeToAgent() {
    if (user?.role === "AGENT") return;
    setUpgradeBusy(true);
    setUpgradeError(null);
    try {
      const callbackUrl = `${window.location.origin}/dashboard/agent-upgrade/paystack`;
      const res = await api.post("/payments/agent-upgrade/initialize", {
        callbackUrl,
        email: user?.email,
      });

      const authorizationUrl = res.data?.authorizationUrl;
      const reference = res.data?.reference;
      if (!authorizationUrl) throw new Error("Missing authorizationUrl");

      if (reference) {
        window.sessionStorage.setItem(
          "gigshub_agent_upgrade_pending",
          JSON.stringify({
            reference,
          })
        );
      }

      window.location.href = authorizationUrl;
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setUpgradeError(maybeError?.response?.data?.error || "Failed to start agent upgrade.");
    } finally {
      setUpgradeBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70 dark:opacity-[0.18]" />
        <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />
        <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-600/25 via-cyan-500/20 to-emerald-400/15 blur-3xl animate-floaty" />
        <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/20 via-blue-500/16 to-cyan-400/12 blur-3xl animate-floaty2" />

        <div className="mx-auto max-w-6xl px-4 py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-gradient-blue">Dashboard</span>
          </h1>
          <div className="mt-6 rounded-3xl border border-zinc-200/70 bg-white/80 p-6 text-sm text-zinc-600 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 dark:text-zinc-400 animate-fade-up">
            Please{" "}
            <Link href="/login" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
              login
            </Link>{" "}
            to view your dashboard.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70 dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />
      <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-600/25 via-cyan-500/20 to-emerald-400/15 blur-3xl animate-floaty" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/20 via-blue-500/16 to-cyan-400/12 blur-3xl animate-floaty2" />

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-4 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 lg:block ${
            sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[280px]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-xs font-semibold tracking-wider text-zinc-500 ${sidebarCollapsed ? "hidden" : "block"}`}>
                ACCOUNT PANEL
              </div>
              <div className={`mt-1 text-sm font-semibold ${sidebarCollapsed ? "hidden" : "block"}`}>Dashboard</div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-500 backdrop-blur transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:bg-zinc-900 lg:flex"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand" : "Collapse"}
            >
              <span className={`text-sm transition-transform ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`}>‹</span>
            </button>
          </div>

          <nav className="mt-5 space-y-1 text-sm">
            {(["overview", "profile", "wallet", "orders", "settings"] as DashboardTab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => pushTab(tab)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-soft"
                      : "text-zinc-600 hover:bg-white/60 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  } ${sidebarCollapsed ? "justify-center" : "justify-start"}`}
                  aria-current={isActive ? "page" : undefined}
                  title={sidebarCollapsed ? tabLabel(tab) : undefined}
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white/80 text-zinc-700 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-200 ${
                      isActive ? "border-white/20 bg-white/15 text-white" : ""
                    }`}
                  >
                    {tabIcon(tab)}
                  </span>
                  <span className={sidebarCollapsed ? "hidden" : "block"}>{tabLabel(tab)}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await logout();
                  router.push("/login");
                })();
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-left text-sm font-semibold text-red-600 backdrop-blur transition hover:bg-red-50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="relative min-w-0 animate-fade-up">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />

          <div className="lg:hidden fixed left-0 right-0 top-20 z-30 px-4">
            <div className="mx-auto max-w-7xl">
              <div className="rounded-3xl border border-zinc-200/70 bg-white/90 p-3 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Dashboard</div>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await logout();
                        router.push("/login");
                      })();
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200/70 bg-white/60 px-3 text-xs font-semibold text-red-600 backdrop-blur transition hover:bg-red-50 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Sign out
                  </button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {(["overview", "profile", "wallet", "orders", "settings"] as DashboardTab[]).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => pushTab(tab)}
                        className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-soft"
                            : "border border-zinc-200/70 bg-white/60 text-zinc-700 backdrop-blur hover:bg-white/80 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {tabLabel(tab)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="lg:hidden h-[112px]" aria-hidden="true" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {timeGreeting()}, {displayName(user?.name, user?.email)}!
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Manage your account and track your performance.</p>
            </div>
            <Link
              href="/store"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95"
            >
              New Order
            </Link>
          </div>

          {recentOrder ? (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-soft dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 animate-fade-up">
              Order placed successfully: <span className="font-semibold">{recentOrder}</span>
            </div>
          ) : null}

          {agentUpgradeStatus === "success" ? (
            <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 shadow-soft dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 animate-fade-up">
              Your account has been upgraded to <span className="font-semibold">Agent</span> status.
            </div>
          ) : agentUpgradeStatus === "error" ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-soft dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 animate-fade-up">
              We couldn&apos;t confirm your agent upgrade. Please try again.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {activeTab === "overview" ? (
              <>
                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-blue-500/25 via-cyan-400/20 to-emerald-400/15 blur-2xl transition-transform duration-500 group-hover:scale-110 dark:from-blue-500/20 dark:via-cyan-400/15 dark:to-emerald-400/10" />
                  <div className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-gradient-to-br from-blue-600/18 to-cyan-400/10 blur-2xl animate-floaty" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold tracking-wide text-zinc-500">Wallet Balance</div>
                      <div className="mt-2 text-2xl font-semibold text-gradient-blue">{formatMoney(walletBalance)}</div>
                      <div className="mt-1 text-xs text-zinc-500">Top up and pay faster at checkout.</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/70 bg-white/70 text-blue-600 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-blue-300">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                        <path d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3V7z" stroke="currentColor" strokeWidth="2" />
                        <path d="M17 12h4v4h-4a2 2 0 110-4z" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Top up amount (GHS)"
                        className="h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-blue-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={depositBusy}
                        onClick={() => depositWithPaystack()}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
                      >
                        {depositBusy ? "..." : "Top up"}
                      </button>
                    </div>

                    {depositTotal > 0 ? (
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Paystack fee</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(String(depositFee))}</span>
                      </div>
                    ) : null}

                    {depositTotal > 0 ? (
                      <div className="mt-1 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Total charged</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(String(depositTotal))}</span>
                      </div>
                    ) : null}

                    {depositError ? (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                        {depositError}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/18 via-lime-400/12 to-cyan-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110 dark:from-emerald-500/14 dark:via-lime-400/10 dark:to-cyan-400/8" />
                  <div className="pointer-events-none absolute -bottom-14 right-10 h-28 w-28 rounded-full bg-gradient-to-br from-emerald-600/16 to-cyan-400/10 blur-2xl animate-floaty2" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold tracking-wide text-zinc-500">Total Orders</div>
                      <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                        {loading ? "..." : String(orders.length)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {loading ? "" : `${orders.filter((o) => String(o.status).toUpperCase() === "COMPLETED").length} successful`}
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/70 bg-white/70 text-emerald-700 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-emerald-300">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                        <path d="M7 7h14M7 12h14M7 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M3 7h.01M3 12h.01M3 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-zinc-800/70 dark:bg-zinc-950/70 lg:col-span-2">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-purple-500/20 via-indigo-400/15 to-blue-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110 dark:from-purple-500/20 dark:via-indigo-400/12 dark:to-blue-400/10" />
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold tracking-wide text-zinc-500">Agent Account</div>
                      <div className="mt-2 text-lg font-semibold">
                        {isAgent ? "Agent status active" : "Upgrade to agent"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {isAgent
                          ? "You now access agent pricing across all bundles."
                          : "Unlock agent-only pricing with a one-time GHS 40 upgrade fee."}
                      </div>
                    </div>
                    {!isAgent ? (
                      <button
                        type="button"
                        disabled={upgradeBusy}
                        onClick={() => upgradeToAgent()}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
                      >
                        {upgradeBusy ? "Redirecting..." : "Upgrade for GHS 40"}
                      </button>
                    ) : (
                      <div className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-100 px-4 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                        Active
                      </div>
                    )}
                  </div>

                  {!isAgent ? (
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 dark:border-zinc-800/70 dark:bg-zinc-950/60">
                        One-time fee
                      </span>
                      <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 dark:border-zinc-800/70 dark:bg-zinc-950/60">
                        Faster margins
                      </span>
                      <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 dark:border-zinc-800/70 dark:bg-zinc-950/60">
                        Agent pricing
                      </span>
                    </div>
                  ) : null}

                  {upgradeError ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                      {upgradeError}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeTab === "profile" ? (
              <div className="group relative overflow-hidden lg:col-span-2 rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-blue-500/18 via-cyan-400/12 to-emerald-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                <div className="text-sm font-semibold">Profile</div>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">Name</span>
                    <span className="font-medium">{user?.name || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">Email</span>
                    <span className="font-medium">{user?.email}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600 dark:text-zinc-400">Phone</span>
                    <span className="font-medium">{user?.phone || "-"}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "wallet" ? (
              <div className="group relative overflow-hidden lg:col-span-2 rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-emerald-500/18 via-lime-400/12 to-cyan-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Wallet</div>
                    <div className="mt-1 text-xs text-zinc-500">Your current wallet balance and top-ups.</div>
                  </div>
                  <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">{formatMoney(walletBalance)}</div>
                </div>

                <div className="mt-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Top up amount (GHS)"
                      className="h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-blue-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-blue-500"
                    />
                    <button
                      type="button"
                      disabled={depositBusy}
                      onClick={() => depositWithPaystack()}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
                    >
                      {depositBusy ? "..." : "Top up"}
                    </button>
                  </div>

                  {depositTotal > 0 ? (
                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Paystack fee</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(String(depositFee))}</span>
                    </div>
                  ) : null}

                  {depositTotal > 0 ? (
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Total charged</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(String(depositTotal))}</span>
                    </div>
                  ) : null}
                  {depositError ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                      {depositError}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <div className="lg:col-span-2 space-y-4">
                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-blue-500/18 via-cyan-400/12 to-emerald-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Account Settings</div>
                      <div className="mt-1 text-xs text-zinc-500">Update your profile details.</div>
                    </div>
                    <button
                      type="button"
                      disabled={profileBusy}
                      onClick={() => saveProfile()}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
                    >
                      {profileBusy ? "Saving..." : "Save"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Username</label>
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Your name"
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-blue-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Phone number</label>
                      <input
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="e.g. 0551234567"
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-blue-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Email address</label>
                      <input
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-blue-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {profileError ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                      {profileError}
                    </div>
                  ) : null}
                  {profileSuccess ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                      {profileSuccess}
                    </div>
                  ) : null}
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-emerald-500/18 via-lime-400/12 to-cyan-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Change Password</div>
                      <div className="mt-1 text-xs text-zinc-500">Use a strong password you haven&apos;t used before.</div>
                    </div>
                    <button
                      type="button"
                      disabled={passwordBusy}
                      onClick={() => changePassword()}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      {passwordBusy ? "Saving..." : "Update"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Current password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-zinc-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-zinc-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">New password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-zinc-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-zinc-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-zinc-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-zinc-600"
                      />
                    </div>
                  </div>

                  {passwordError ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                      {passwordError}
                    </div>
                  ) : null}
                  {passwordSuccess ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                      {passwordSuccess}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`group relative mt-6 overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 ${
              activeTab === "orders" || activeTab === "overview" ? "block" : "hidden"
            }`}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-blue-500/18 via-cyan-400/12 to-emerald-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">{activeTab === "orders" ? "Orders" : "Recent Orders"}</h2>
              {activeTab !== "orders" ? (
                <button
                  type="button"
                  onClick={() => pushTab("orders")}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  View all
                </button>
              ) : null}
            </div>

            {activeTab === "orders" && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Search orders by ID, recipient, product, or status..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700/70 dark:bg-zinc-900/80 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
                />
              </div>
            )}

            {loading ? (
              <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
            ) : displayOrders.length === 0 ? (
              <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                {activeTab === "orders" && orderSearch ? "No orders match your search." : "No orders yet."}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200/70 text-xs font-semibold text-zinc-500 dark:border-zinc-800/70">
                      <th className="py-3">Order ID</th>
                      <th className="py-3">Recipient</th>
                      <th className="py-3">Product</th>
                      <th className="py-3">Provider</th>
                      <th className="py-3">Amount</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Date | Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableOrders.map((o) => {
                      const firstItem = o.items?.[0];
                      const productName = firstItem?.product?.name;
                      const recipient = firstItem?.recipientPhone || "-";
                      return (
                        <tr key={o.id} className="border-b border-zinc-100/70 transition-colors hover:bg-white/60 dark:border-zinc-900/70 dark:hover:bg-zinc-900/40">
                          <td className="py-3 font-medium">{formatOrderLabel(o.orderCode, o.id)}</td>
                          <td className="py-3 text-zinc-600 dark:text-zinc-400">{recipient}</td>
                          <td className="py-3 text-zinc-600 dark:text-zinc-400">{productName || "-"}</td>
                          <td className="py-3 text-zinc-600 dark:text-zinc-400">{inferProviderFromProductName(productName)}</td>
                          <td className="py-3 font-semibold">{formatMoney(o.total)}</td>
                          <td className="py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(o.status)}`}>
                              {statusLabel(o.status)}
                            </span>
                          </td>
                          <td className="py-3 text-zinc-600 dark:text-zinc-400">{new Date(o.createdAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70 dark:opacity-[0.18]" />
          <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />
          <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-600/25 via-cyan-500/20 to-emerald-400/15 blur-3xl animate-floaty" />
          <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/20 via-blue-500/16 to-cyan-400/12 blur-3xl animate-floaty2" />

          <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 text-sm text-zinc-600 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 dark:text-zinc-400 animate-fade-up">
              Loading...
            </div>
          </div>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
