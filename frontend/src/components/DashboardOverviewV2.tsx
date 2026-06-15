"use client";

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
  if (s === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (s === "PROCESSING") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

function formatDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function orderLabel(o: { orderCode?: string | null; id: string }) {
  const raw = o.orderCode || `Order #${o.id.slice(-6).toUpperCase()}`;
  return raw.length > 18 ? `${raw.slice(0, 18)}...` : raw;
}

type OrderItem = {
  id: string;
  orderCode?: string | null;
  status: string;
  total: string;
  createdAt: string;
  items: { id: string; quantity: number; recipientPhone?: string | null; product: { name: string } }[];
};

export function DashboardOverviewV2({
  walletBalance,
  depositAmount,
  setDepositAmount,
  depositBusy,
  depositWithPaystack,
  depositTotal,
  depositFee,
  depositError,
  loading,
  orders,
  isAgent,
  upgradeBusy,
  upgradeToAgent,
  upgradeError,
  referralCode,
  user,
  pushTab,
}: {
  walletBalance: string;
  depositAmount: string;
  setDepositAmount: (v: string) => void;
  depositBusy: boolean;
  depositWithPaystack: () => void;
  depositTotal: number;
  depositFee: number;
  depositError: string | null;
  loading: boolean;
  orders: OrderItem[];
  isAgent: boolean;
  upgradeBusy: boolean;
  upgradeToAgent: () => void;
  upgradeError: string | null;
  referralCode: string;
  user: { name: string | null; email: string } | null;
  pushTab: (tab: string) => void;
}) {
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      {/* Mobile Hero - hidden on lg+ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white shadow-lg lg:hidden">
        <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-xl font-bold leading-tight">
            {timeGreeting()},<br />
            {displayName(user?.name, user?.email)} 👋
          </h1>
          <p className="mt-1.5 text-sm text-white/80">
            Here&apos;s what&apos;s happening with your account today.
          </p>
        </div>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-20">
          <svg width="100" height="80" viewBox="0 0 100 80" fill="none">
            <rect x="55" y="10" width="40" height="30" rx="3" fill="white" />
            <rect x="5" y="40" width="50" height="30" rx="3" fill="white" opacity="0.7" />
            <path d="M10 55 L25 48 L40 52 L55 42" stroke="white" strokeWidth="2" fill="none" />
            <circle cx="75" cy="25" r="8" fill="white" opacity="0.5" />
            <rect x="60" y="50" width="30" height="4" rx="2" fill="white" opacity="0.5" />
            <rect x="60" y="58" width="20" height="4" rx="2" fill="white" opacity="0.3" />
          </svg>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white lg:hidden">Quick Actions</h2>
        <div className="mt-3 grid grid-cols-4 gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => pushTab("orders")}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">New Order</span>
          </button>

          <button
            type="button"
            onClick={() => pushTab("wallet")}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Top Up</span>
          </button>

          <button
            type="button"
            onClick={() => pushTab("wallet")}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3V7z" stroke="currentColor" strokeWidth="2"/><path d="M17 12h4v4h-4a2 2 0 110-4z" stroke="currentColor" strokeWidth="2"/></svg>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Wallet</span>
          </button>

          <button
            type="button"
            onClick={() => pushTab("orders")}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 7h14M7 12h14M7 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M3 7h.01M3 12h.01M3 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Orders</span>
          </button>
        </div>
      </div>

      {/* Main Cards Row - Wallet + Orders */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Wallet Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 p-5 text-white shadow-lg lg:rounded-3xl lg:bg-gradient-to-br lg:from-indigo-500 lg:to-blue-600">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3V7z"/><path d="M17 12h4v4h-4a2 2 0 110-4z"/></svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90">Wallet Balance</div>
                  <div className="mt-0.5 text-[11px] text-white/70">Top up and pay faster at checkout.</div>
                </div>
              </div>
              <button className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <div className="mt-5">
              <div className="text-3xl font-bold">{formatMoney(walletBalance)}</div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => pushTab("wallet")}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/20 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                Top up now
              </button>
            </div>
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/10 via-teal-400/8 to-cyan-400/8 blur-2xl" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path d="M7 7h14M7 12h14M7 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M3 7h.01M3 12h.01M3 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Orders</div>
            </div>
            <button onClick={() => pushTab("orders")} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : String(orders.length)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Order{orders.length !== 1 ? "s" : ""} placed so far
            </div>
            <button
              onClick={() => pushTab("orders")}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              View all orders →
            </button>
          </div>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-50 to-violet-50 p-5 dark:from-indigo-950/30 dark:to-violet-950/30 lg:hidden">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white">Fast. Easy. Secure.</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Top up your wallet and pay faster with LOFAQ Data Hub.</div>
          </div>
          <button
            type="button"
            onClick={() => pushTab("wallet")}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Top Up Now
          </button>
        </div>
      </div>

      {/* Desktop: Agent + Referral Cards */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
        {/* Agent Account */}
        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-indigo-500/[0.04] to-transparent" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Agent Account</div>
              </div>
              <div className="mt-3 text-xl font-bold">
                {isAgent ? "Agent status active" : "Upgrade to agent"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {isAgent
                  ? "You now access agent pricing across all bundles."
                  : "Unlock agent-only pricing with a one-time GHS 40 upgrade fee."}
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              {!isAgent ? (
                <>
                  <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Upgrade for</div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">GHS 40</div>
                  <button
                    type="button"
                    disabled={upgradeBusy}
                    onClick={upgradeToAgent}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 disabled:opacity-60"
                  >
                    {upgradeBusy ? "Redirecting..." : "Upgrade Now"}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </>
              ) : (
                <div className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-100 px-4 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Active
                </div>
              )}
            </div>
          </div>
          {upgradeError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {upgradeError}
            </div>
          ) : null}
        </div>

        {/* Referral Program */}
        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-amber-500/10 via-orange-400/8 to-rose-400/8 blur-2xl" />
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              </div>
              <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Referral Program</div>
            </div>
            <div className="mt-2 text-lg font-bold">Invite friends and earn exciting rewards!</div>
          </div>
          {referralCode ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-sm font-mono font-bold tracking-widest text-slate-800 dark:text-slate-200">{referralCode}</span>
                <button
                  type="button"
                  onClick={() => { void navigator.clipboard.writeText(referralCode); }}
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:shadow-sm dark:hover:bg-slate-700"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const link = `${window.location.origin}/register?ref=${referralCode}`;
                  void navigator.clipboard.writeText(link);
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Share Now
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 dark:text-white">Recent Orders</div>
          <button onClick={() => pushTab("orders")} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
            View all
          </button>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="mt-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No orders yet. Start shopping!
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {recentOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => pushTab("orders")}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-all hover:shadow-soft dark:border-slate-800 dark:bg-slate-800/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="block max-w-full truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {orderLabel(order)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPill(order.status)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    {order.status}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatMoney(order.total)}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-300 dark:text-slate-600"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
