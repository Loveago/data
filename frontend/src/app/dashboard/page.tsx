"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { AgentStorefront, StorefrontProduct, User } from "@/lib/types";
import { DashboardOverviewV2 } from "@/components/DashboardOverviewV2";
import { StorefrontSettings } from "@/components/StorefrontSettings";

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

function formatDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

function extractGbValue(name: string) {
  const m = /(\d+(?:\.\d+)?)\s*gb/i.exec(String(name || ""));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

type DashboardTab = "overview" | "profile" | "wallet" | "orders" | "affiliate" | "storefront" | "api-access" | "settings";

function normalizeTab(value: string | null): DashboardTab {
  const v = String(value || "").toLowerCase();
  if (v === "profile" || v === "wallet" || v === "orders" || v === "affiliate" || v === "settings" || v === "storefront" || v === "api-access") return v;
  return "overview";
}

function tabLabel(tab: DashboardTab) {
  if (tab === "profile") return "Profile";
  if (tab === "wallet") return "Wallet";
  if (tab === "orders") return "Orders";
  if (tab === "affiliate") return "Affiliate";
  if (tab === "storefront") return "Storefront";
  if (tab === "api-access") return "API Access";
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

  if (tab === "storefront") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path d="M4 7h16v12H4V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M3 7l1-3h16l1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  if (tab === "affiliate") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "api-access") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path d="M7 8h10M7 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M14 14l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normalizeTab(searchParams.get("tab")));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("gigshub_dashboard_sidebar_collapsed") === "1";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [walletBalance, setWalletBalance] = useState<string>(user?.walletBalance || "0");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositFee, setDepositFee] = useState<number>(0);
  const [depositTotal, setDepositTotal] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawMomoNumber, setWithdrawMomoNumber] = useState<string>("");
  const [withdrawMomoNetwork, setWithdrawMomoNetwork] = useState<string>("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [withdrawFee, setWithdrawFee] = useState<string>("0");
  const [withdrawTotal, setWithdrawTotal] = useState<string>("0");
  const [upgradeError] = useState<string | null>(null);
  const [apiAccessRequest, setApiAccessRequest] = useState<{ id: string; status: string; reason: string | null; apiKey: { key: string; isActive: boolean; lastUsedAt: string | null } | null } | null>(null);
  const [apiAccessLoading, setApiAccessLoading] = useState(false);
  const [apiAccessReason, setApiAccessReason] = useState("");
  const [apiAccessSubmitting, setApiAccessSubmitting] = useState(false);
  const [apiAccessError, setApiAccessError] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const isAgent = user?.role === "AGENT" || user?.role === "SUPER_AGENT";

  const [storefront, setStorefront] = useState<AgentStorefront | null>(null);
  const [storefrontItems, setStorefrontItems] = useState<StorefrontProduct[]>([]);
  const [storefrontPrices, setStorefrontPrices] = useState<Record<string, string>>({});
  const [storefrontTitle, setStorefrontTitle] = useState<string>("");
  const [storefrontWelcome, setStorefrontWelcome] = useState<string>("");
  const [storefrontEmoji, setStorefrontEmoji] = useState<string>("");
  const [storefrontAccent, setStorefrontAccent] = useState<string>("#1d4ed8");
  const [storefrontSlug, setStorefrontSlug] = useState<string>("");
  const [storefrontWhatsapp, setStorefrontWhatsapp] = useState<string>("");
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontError, setStorefrontError] = useState<string | null>(null);
  const [storefrontInfoSaving, setStorefrontInfoSaving] = useState(false);
  const [storefrontPricesSaving, setStorefrontPricesSaving] = useState(false);
  const [storefrontSuccess, setStorefrontSuccess] = useState<string | null>(null);
  const [storefrontSearch, setStorefrontSearch] = useState<string>("");

  const [affiliateReferrals, setAffiliateReferrals] = useState<{ id: string; email: string; name: string | null; joinedAt: string }[]>([]);
  const [affiliateEarnings, setAffiliateEarnings] = useState<string>("0");
  const [affiliateCode, setAffiliateCode] = useState<string>(user?.referralCode || "");
  const [affiliateLoading, setAffiliateLoading] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState("");
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersLimit = 10;
  const [ordersTotal, setOrdersTotal] = useState(0);

  const referralCode = affiliateCode || user?.referralCode || "";

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

  const dashboardTabs: DashboardTab[] = ["overview", "profile", "wallet", "orders", "affiliate", "storefront", "api-access", "settings"];

  const filteredStorefrontItems = useMemo(() => {
    const q = storefrontSearch.trim().toLowerCase();
    const items = [...storefrontItems];
    items.sort((a, b) => {
      const ga = extractGbValue(a.product.name || "");
      const gb = extractGbValue(b.product.name || "");
      if (ga != null && gb != null && ga !== gb) return ga - gb;
      if (ga != null && gb == null) return -1;
      if (ga == null && gb != null) return 1;
      return String(a.product.name || "").localeCompare(String(b.product.name || ""));
    });
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.product.name} ${item.product.slug} ${item.product.category?.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [storefrontItems, storefrontSearch]);

  const storefrontLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!storefrontSlug) return "";
    return `${window.location.origin}/storefront/${storefrontSlug}`;
  }, [storefrontSlug]);

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
    if (!isAuthenticated) {
      setStorefront(null);
      setStorefrontItems([]);
      setStorefrontPrices({});
      return;
    }

    let cancelled = false;

    async function loadStorefront() {
      setStorefrontLoading(true);
      setStorefrontError(null);
      try {
        const [storeRes, productsRes] = await Promise.all([
          api.get<{ storefront: AgentStorefront }>("/agent-storefront/me"),
          api.get<{ items: StorefrontProduct[] }>("/agent-storefront/me/products"),
        ]);

        if (cancelled) return;
        const storefrontData = storeRes.data.storefront || null;
        setStorefront(storefrontData);
        setStorefrontTitle(storefrontData?.title || '');
        setStorefrontWelcome(storefrontData?.welcomeMessage || '');
        setStorefrontEmoji(storefrontData?.heroEmoji || '');
        setStorefrontAccent(storefrontData?.accentColor || '#1d4ed8');
        setStorefrontSlug(storefrontData?.slug || '');
        setStorefrontWhatsapp(storefrontData?.whatsappLink || '');

        const items = productsRes.data.items || [];
        setStorefrontItems(items);

        const nextPrices: Record<string, string> = {};
        for (const item of items) {
          nextPrices[item.product.id] = item.sellPrice || '';
        }
        setStorefrontPrices(nextPrices);
      } catch (e: unknown) {
        if (cancelled) return;
        const maybeError = e as { response?: { data?: { error?: string } } };
        setStorefrontError(maybeError?.response?.data?.error || "Failed to load storefront data.");
      } finally {
        if (!cancelled) setStorefrontLoading(false);
      }
    }

    loadStorefront();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab !== "api-access" || !isAuthenticated) return;
    let cancelled = false;
    async function loadApiAccess() {
      setApiAccessLoading(true);
      setApiAccessError(null);
      try {
        const res = await api.get<{ request: { id: string; status: string; reason: string | null; apiKey: { key: string; isActive: boolean; lastUsedAt: string | null } | null } | null }>("/api-access/my");
        if (!cancelled) setApiAccessRequest(res.data.request);
      } catch {
        if (!cancelled) setApiAccessError("Failed to load API access info.");
      } finally {
        if (!cancelled) setApiAccessLoading(false);
      }
    }
    loadApiAccess();
    return () => { cancelled = true; };
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (activeTab !== "affiliate" || !isAuthenticated) return;
    let cancelled = false;
    async function loadAffiliate() {
      setAffiliateLoading(true);
      try {
        const res = await api.get<{ referralCode: string; referrals: { id: string; email: string; name: string | null; joinedAt: string }[]; totalEarnings: string }>("/auth/referral-info");
        if (cancelled) return;
        setAffiliateReferrals(res.data.referrals || []);
        setAffiliateEarnings(res.data.totalEarnings || "0");
        setAffiliateCode(res.data.referralCode || "");
        if (res.data.referralCode && user && !user.referralCode) {
          updateSession({ user: { ...user, referralCode: res.data.referralCode } });
        }
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setAffiliateLoading(false);
      }
    }
    loadAffiliate();
    return () => { cancelled = true; };
  }, [activeTab, isAuthenticated, updateSession, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("gigshub_dashboard_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  function pushTab(next: DashboardTab) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", next);
    router.push(`/dashboard?${sp.toString()}`);
    setMobileSidebarOpen(false);
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
        const res = await api.get<{ items: Order[]; total?: number }>("/orders/my", {
          params: { page: ordersPage, limit: ordersLimit },
        });
        if (!cancelled) {
          setOrders(res.data.items || []);
          setOrdersTotal(Number(res.data.total || 0));
        }
      } catch {
        if (!cancelled) {
          setOrders([]);
          setOrdersTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, ordersPage]);

  const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / ordersLimit));

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

  useEffect(() => {
    let cancelled = false;
    const amount = Number(withdrawAmount);

    async function loadWithdrawQuote() {
      try {
        const res = await api.post<{ amount: string; fee: string; totalDeducted: string }>("/wallet/withdraw/quote", { amount });
        if (cancelled) return;
        setWithdrawFee(res.data?.fee || "0");
        setWithdrawTotal(res.data?.totalDeducted || "0");
      } catch {
        if (cancelled) return;
        setWithdrawFee("0");
        setWithdrawTotal("0");
      }
    }

    if (isAuthenticated && Number.isFinite(amount) && amount >= 50) {
      const t = window.setTimeout(() => { loadWithdrawQuote(); }, 300);
      return () => { cancelled = true; window.clearTimeout(t); };
    }

    setWithdrawFee("0");
    setWithdrawTotal("0");
    return () => { cancelled = true; };
  }, [withdrawAmount, isAuthenticated]);

  async function withdrawFromWallet() {
    setWithdrawBusy(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);
    try {
      const amount = Number(withdrawAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setWithdrawError("Enter a valid amount.");
        return;
      }
      if (amount < 50) {
        setWithdrawError("Minimum withdrawal is GHS 50.");
        return;
      }
      if (!withdrawMomoNumber.trim() || withdrawMomoNumber.trim().length < 10) {
        setWithdrawError("Enter a valid MoMo number.");
        return;
      }
      if (!withdrawMomoNetwork) {
        setWithdrawError("Select your MoMo network.");
        return;
      }

      const res = await api.post<{ walletBalance: string; withdrawn: string; fee: string; totalDeducted: string }>("/wallet/withdraw", {
        amount,
        momoNumber: withdrawMomoNumber.trim(),
        momoNetwork: withdrawMomoNetwork,
      });
      setWalletBalance(res.data.walletBalance || "0");
      setWithdrawSuccess(`GHS ${res.data.withdrawn} withdrawal submitted (fee: GHS ${res.data.fee}). Pending admin approval.`);
      setWithdrawAmount("");
      setWithdrawMomoNumber("");
      setWithdrawMomoNetwork("");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setWithdrawError(maybeError?.response?.data?.error || "Withdrawal failed.");
    } finally {
      setWithdrawBusy(false);
    }
  }

  async function requestApiAccess() {
    setApiAccessSubmitting(true);
    setApiAccessError(null);
    try {
      const res = await api.post<{ request: { id: string; status: string; reason: string | null; apiKey: null } }>("/api-access/request", { reason: apiAccessReason });
      setApiAccessRequest(res.data.request);
      setApiAccessReason("");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string; request?: { id: string; status: string; reason: string | null; apiKey: { key: string; isActive: boolean; lastUsedAt: string | null } | null } } } };
      if (maybeError?.response?.data?.request) setApiAccessRequest(maybeError.response.data.request);
      setApiAccessError(maybeError?.response?.data?.error || "Failed to submit request.");
    } finally {
      setApiAccessSubmitting(false);
    }
  }

  async function saveStorefrontInfo() {
    setStorefrontInfoSaving(true);
    setStorefrontError(null);
    setStorefrontSuccess(null);
    try {
      const res = await api.put<{ storefront: AgentStorefront }>("/agent-storefront/me", {
        title: storefrontTitle,
        welcomeMessage: storefrontWelcome,
        heroEmoji: storefrontEmoji,
        accentColor: storefrontAccent,
        slug: storefrontSlug,
        whatsappLink: storefrontWhatsapp,
      });
      const data = res.data.storefront;
      setStorefront(data);
      setStorefrontTitle(data?.title || '');
      setStorefrontWelcome(data?.welcomeMessage || '');
      setStorefrontEmoji(data?.heroEmoji || '');
      setStorefrontAccent(data?.accentColor || '#1d4ed8');
      setStorefrontSlug(data?.slug || '');
      setStorefrontWhatsapp(data?.whatsappLink || '');
      setStorefrontSuccess("Storefront details updated.");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setStorefrontError(maybeError?.response?.data?.error || "Failed to update storefront.");
    } finally {
      setStorefrontInfoSaving(false);
    }
  }

  async function saveStorefrontPrices() {
    setStorefrontPricesSaving(true);
    setStorefrontError(null);
    setStorefrontSuccess(null);
    try {
      const payload = Object.entries(storefrontPrices).map(([productId, sellPrice]) => ({
        productId,
        sellPrice: sellPrice.trim(),
      }));
      await api.put("/agent-storefront/me/prices", {
        prices: payload,
      });
      const refreshed = await api.get<{ items: StorefrontProduct[] }>("/agent-storefront/me/products");
      const items = refreshed.data.items || [];
      setStorefrontItems(items);
      const nextPrices: Record<string, string> = {};
      for (const item of items) {
        nextPrices[item.product.id] = item.sellPrice || '';
      }
      setStorefrontPrices(nextPrices);
      setStorefrontSuccess("Storefront prices saved.");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setStorefrontError(maybeError?.response?.data?.error || "Failed to save storefront prices.");
    } finally {
      setStorefrontPricesSaving(false);
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-60 dark:opacity-[0.12]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />
      <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-emerald-400/12 blur-3xl animate-floaty" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/18 via-indigo-500/14 to-violet-400/10 blur-3xl animate-floaty2" />

      <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`hidden rounded-3xl border border-slate-200/70 bg-white p-4 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70 lg:block ${
            sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[280px]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-wider text-slate-500 ${sidebarCollapsed ? "hidden" : "block"}`}>
                ACCOUNT PANEL
              </div>
              <div className={`mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200 ${sidebarCollapsed ? "hidden" : "block"}`}>Dashboard</div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 lg:flex"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand" : "Collapse"}
            >
              <span className={`text-sm transition-transform ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`}>‹</span>
            </button>
          </div>

          <nav className="mt-5 space-y-1 text-sm">
            {dashboardTabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => pushTab(tab)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  } ${sidebarCollapsed ? "justify-center" : "justify-start"}`}
                  aria-current={isActive ? "page" : undefined}
                  title={sidebarCollapsed ? tabLabel(tab) : undefined}
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-slate-700 dark:text-slate-200 ${
                      isActive
                        ? "border-white/20 bg-white/15 text-white"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    {tabIcon(tab)}
                  </span>
                  <span className={sidebarCollapsed ? "hidden" : "block"}>{tabLabel(tab)}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await logout();
                  router.push("/login");
                })();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
              <span className={sidebarCollapsed ? "hidden" : "block"}>Sign out</span>
            </button>
          </div>
        </aside>

        <main className="relative min-w-0 animate-fade-up pb-36 md:pb-0">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />

          <div className="mb-4 px-1 lg:hidden">
            <div className="w-full">
              <div className="rounded-full border border-slate-200/80 bg-white/95 p-2 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen((v) => !v)}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {mobileSidebarOpen ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
                    )}
                    {mobileSidebarOpen ? "Close" : "Menu"}
                  </button>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Dashboard</div>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await logout();
                        router.push("/login");
                      })();
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200/70 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-slate-700/70 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {mobileSidebarOpen ? (
            <div className="mb-4 rounded-3xl border border-slate-200/80 bg-white/95 p-3 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90 lg:hidden">
              <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-3 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Account Panel</div>
                <div className="mt-1 text-base font-bold">Dashboard Navigation</div>
              </div>

              <nav className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {dashboardTabs.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => pushTab(tab)}
                      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left font-medium transition-colors ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${
                          isActive
                            ? "border-white/20 bg-white/15 text-white"
                            : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {tabIcon(tab)}
                      </span>
                      <span className="truncate">{tabLabel(tab)}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ) : null}

          <div className="hidden lg:flex lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {timeGreeting()}, {displayName(user?.name, user?.email)} 👋
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Here&apos;s what&apos;s happening with your account today.</p>
            </div>
            <Link
              href="/store"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              New Order
            </Link>
          </div>

          {recentOrder ? (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-card dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 animate-fade-up">
              Order placed successfully: <span className="font-semibold">{recentOrder}</span>
            </div>
          ) : null}

          {null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {activeTab === "overview" ? (
              <div className="lg:col-span-2">
                <DashboardOverviewV2
                  walletBalance={walletBalance}
                  depositAmount={depositAmount}
                  setDepositAmount={setDepositAmount}
                  depositBusy={depositBusy}
                  depositWithPaystack={depositWithPaystack}
                  depositTotal={depositTotal}
                  depositFee={depositFee}
                  depositError={depositError}
                  loading={loading}
                  orders={orders}
                  isAgent={isAgent}
                  upgradeBusy={false}
                  upgradeToAgent={() => pushTab("api-access")}
                  upgradeError={upgradeError}
                  referralCode={referralCode}
                  user={user}
                  pushTab={(tab: string) => pushTab(tab as DashboardTab)}
                />
              </div>
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

            {activeTab === "affiliate" ? (
              <div className="lg:col-span-2 space-y-4">
                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-amber-500/20 via-orange-400/15 to-rose-400/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-zinc-500">Referral Program</div>
                    <div className="mt-2 text-lg font-semibold">Earn 3% on every purchase</div>
                    <div className="mt-1 text-sm text-zinc-500">Share your affiliate link below. When someone signs up through your link and makes a purchase, you earn 3% of their order value directly into your wallet.</div>
                  </div>

                  {user?.referralCode ? (
                    <div className="mt-5 space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-zinc-500 mb-1.5">Your Referral Code</div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex h-10 flex-1 items-center rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm font-mono font-bold tracking-widest text-zinc-900 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-100">
                            {user.referralCode}
                          </div>
                          <button
                            type="button"
                            onClick={() => { void navigator.clipboard.writeText(user?.referralCode || ""); }}
                            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-white/70 px-4 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-200"
                          >
                            Copy code
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-zinc-500 mb-1.5">Your Affiliate Link</div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex h-10 flex-1 items-center overflow-x-auto rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 text-sm font-medium text-zinc-800 backdrop-blur dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-zinc-100">
                            {typeof window !== "undefined" ? `${window.location.origin}/register?ref=${user.referralCode}` : `/register?ref=${user.referralCode}`}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const link = `${window.location.origin}/register?ref=${user?.referralCode || ""}`;
                              void navigator.clipboard.writeText(link);
                            }}
                            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95"
                          >
                            Copy link
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                    <div className="text-xs font-semibold tracking-wide text-zinc-500">Total Referrals</div>
                    <div className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">{affiliateReferrals.length}</div>
                    <div className="mt-1 text-xs text-zinc-500">Users signed up with your link</div>
                  </div>
                  <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                    <div className="text-xs font-semibold tracking-wide text-zinc-500">Total Earnings</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(affiliateEarnings)}</div>
                    <div className="mt-1 text-xs text-zinc-500">Earned from referral purchases</div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="text-sm font-semibold">Referred Users</div>
                  <div className="mt-1 text-xs text-zinc-500">People who signed up using your affiliate link.</div>

                  {affiliateLoading ? (
                    <div className="mt-4 text-sm text-zinc-500">Loading...</div>
                  ) : affiliateReferrals.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-950/30">
                      No referrals yet. Share your affiliate link to start earning!
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="pb-2 text-left text-xs font-semibold text-zinc-500">Name</th>
                            <th className="pb-2 text-left text-xs font-semibold text-zinc-500">Email</th>
                            <th className="pb-2 text-right text-xs font-semibold text-zinc-500">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affiliateReferrals.map((r) => (
                            <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                              <td className="py-2.5 font-medium">{r.name || "-"}</td>
                              <td className="py-2.5 text-zinc-600 dark:text-zinc-400">{r.email}</td>
                              <td className="py-2.5 text-right text-zinc-500">{formatDate(r.joinedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "api-access" ? (
              <div className="lg:col-span-2 space-y-4">
                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-violet-500/18 via-blue-400/12 to-cyan-400/10 blur-2xl" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Developer API</div>
                      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">API Access</div>
                      <div className="mt-1 text-sm text-zinc-500">Integrate our data bundle platform directly into your website or application.</div>
                    </div>
                    <a href="/api-docs" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-all dark:border-violet-800/40 dark:bg-violet-950/30 dark:text-violet-300">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/></svg>
                      View Docs
                    </a>
                  </div>

                  {apiAccessLoading ? (
                    <div className="mt-6 text-sm text-zinc-500">Loading...</div>
                  ) : apiAccessRequest?.status === "APPROVED" && apiAccessRequest.apiKey?.isActive ? (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/30">
                        <div className="flex items-center gap-2 mb-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="#10b981" strokeWidth="2"/></svg>
                          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">API Access Active</span>
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Your API key is active. Keep it secret — treat it like a password.</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-500 mb-1.5">Your API Key</div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex-1 rounded-xl border border-zinc-200/70 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-800 break-all dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-200">
                            {apiAccessRequest.apiKey.key}
                          </div>
                          <button
                            type="button"
                            onClick={() => { void navigator.clipboard.writeText(apiAccessRequest?.apiKey?.key || ""); setApiKeyCopied(true); setTimeout(() => setApiKeyCopied(false), 2000); }}
                            className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-700 transition-all dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                          >
                            {apiKeyCopied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">
                        Send <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">x-api-key: YOUR_KEY</code> in request headers.
                        {" "}<a href="/api-docs" target="_blank" className="text-blue-600 underline dark:text-blue-400">Read the docs →</a>
                      </div>
                    </div>
                  ) : apiAccessRequest?.status === "PENDING" ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/40 dark:bg-amber-950/30">
                      <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">Request Pending</div>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Your API access request is under review. You will gain access once an admin approves it.</p>
                    </div>
                  ) : apiAccessRequest?.status === "REJECTED" ? (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-800/40 dark:bg-red-950/30">
                      <div className="text-sm font-semibold text-red-800 dark:text-red-300">Request Rejected</div>
                      <p className="mt-1 text-xs text-red-700 dark:text-red-400">Your request was not approved. Contact support for more information.</p>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-3">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Request API Access</div>
                      <p className="text-xs text-zinc-500">Submit a request and an admin will review it. Once approved, you&apos;ll receive an API key to integrate our platform.</p>
                      <textarea
                        value={apiAccessReason}
                        onChange={(e) => setApiAccessReason(e.target.value)}
                        placeholder="Briefly describe how you plan to use the API (optional)"
                        rows={3}
                        className="w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none backdrop-blur resize-none transition-colors focus:border-violet-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-violet-500"
                      />
                      {apiAccessError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">{apiAccessError}</div>}
                      <button
                        type="button"
                        disabled={apiAccessSubmitting}
                        onClick={requestApiAccess}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
                      >
                        {apiAccessSubmitting ? "Submitting..." : "Request Access"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "storefront" ? (
              <div className="lg:col-span-2">
                <StorefrontSettings
                  isAgent={isAgent}
                  storefront={storefront}
                  storefrontItems={storefrontItems}
                  storefrontPrices={storefrontPrices}
                  setStorefrontPrices={setStorefrontPrices}
                  storefrontTitle={storefrontTitle}
                  setStorefrontTitle={setStorefrontTitle}
                  storefrontSlug={storefrontSlug}
                  setStorefrontSlug={setStorefrontSlug}
                  storefrontEmoji={storefrontEmoji}
                  setStorefrontEmoji={setStorefrontEmoji}
                  storefrontWelcome={storefrontWelcome}
                  setStorefrontWelcome={setStorefrontWelcome}
                  storefrontWhatsapp={storefrontWhatsapp}
                  setStorefrontWhatsapp={setStorefrontWhatsapp}
                  storefrontAccent={storefrontAccent}
                  setStorefrontAccent={setStorefrontAccent}
                  storefrontLink={storefrontLink}
                  storefrontLoading={storefrontLoading}
                  storefrontError={storefrontError}
                  storefrontSuccess={storefrontSuccess}
                  storefrontInfoSaving={storefrontInfoSaving}
                  storefrontPricesSaving={storefrontPricesSaving}
                  saveStorefrontInfo={saveStorefrontInfo}
                  saveStorefrontPrices={saveStorefrontPrices}
                  filteredStorefrontItems={filteredStorefrontItems}
                  storefrontSearch={storefrontSearch}
                  setStorefrontSearch={setStorefrontSearch}
                />
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

                <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                  <div className="text-sm font-semibold">Withdraw</div>
                  <div className="mt-1 text-xs text-zinc-500">Withdraw funds from your wallet. 2% fee applies. Minimum GHS 50.</div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">MoMo Number</label>
                      <input
                        value={withdrawMomoNumber}
                        onChange={(e) => setWithdrawMomoNumber(e.target.value)}
                        placeholder="e.g. 0241234567"
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-orange-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Network</label>
                      <select
                        value={withdrawMomoNetwork}
                        onChange={(e) => setWithdrawMomoNetwork(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-orange-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-orange-500"
                      >
                        <option value="">Select network</option>
                        <option value="MTN">MTN</option>
                        <option value="VODAFONE">Vodafone</option>
                        <option value="AIRTELTIGO">AirtelTigo</option>
                        <option value="TELECEL">Telecel</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Amount (GHS)</label>
                      <input
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Min. 50"
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 text-sm outline-none backdrop-blur transition-colors focus:border-orange-400 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {Number(withdrawFee) > 0 ? (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                        <span>2% fee</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(withdrawFee)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Total deducted</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(withdrawTotal)}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={withdrawBusy}
                      onClick={() => withdrawFromWallet()}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
                    >
                      {withdrawBusy ? "Processing..." : "Submit Withdrawal"}
                    </button>
                  </div>

                  {withdrawError ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                      {withdrawError}
                    </div>
                  ) : null}
                  {withdrawSuccess ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                      {withdrawSuccess}
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

            {activeTab === "orders" && !loading ? (
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  disabled={ordersPage <= 1}
                  onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Prev
                </button>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Page {ordersPage} of {ordersTotalPages}
                </div>
                <button
                  type="button"
                  disabled={ordersPage >= ordersTotalPages}
                  onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Next
                </button>
              </div>
            ) : null}
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
