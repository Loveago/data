"use client";

import Link from "next/link";

function formatMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export function DashboardOverview({
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
  orders: { status: string }[];
  isAgent: boolean;
  upgradeBusy: boolean;
  upgradeToAgent: () => void;
  upgradeError: string | null;
  referralCode: string;
}) {
  return (
    <>
      {/* Wallet Balance */}
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-indigo-500/15 via-violet-400/10 to-purple-400/10 blur-2xl" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3V7z" stroke="currentColor" strokeWidth="2" />
                <path d="M17 12h4v4h-4a2 2 0 110-4z" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Wallet Balance</div>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
          </button>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{formatMoney(walletBalance)}</div>
          <div className="mt-1 text-xs text-slate-500">Top up and pay faster at checkout.</div>
        </div>
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Enter amount (GHS)"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500"
            />
            <button
              type="button"
              disabled={depositBusy}
              onClick={depositWithPaystack}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 disabled:opacity-60"
            >
              {depositBusy ? "..." : "Top up"}
            </button>
          </div>
          {depositTotal > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Paystack fee</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(String(depositFee))}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Total charged</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(String(depositTotal))}</span>
              </div>
            </div>
          ) : null}
          {depositError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {depositError}
            </div>
          ) : null}
        </div>
      </div>

      {/* Total Orders */}
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 dark:border-slate-700/70 dark:bg-slate-900/70">
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
          <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {loading ? "..." : String(orders.length)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l5-5 5 5M12 12V3"/></svg>
            <span>+23% from last week</span>
          </div>
        </div>
      </div>

      {/* Agent Account */}
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 dark:border-slate-700/70 dark:bg-slate-900/70 lg:col-span-2">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-indigo-500/[0.04] to-transparent" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
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
            {!isAgent ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  One-time fee
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Faster margins
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Agent pricing
                </span>
              </div>
            ) : null}
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 dark:border-slate-700/70 dark:bg-slate-900/70 lg:col-span-2">
        <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-amber-500/10 via-orange-400/8 to-rose-400/8 blur-2xl" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              </div>
              <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Referral Program</div>
            </div>
            <div className="mt-2 text-lg font-bold">Invite friends and earn exciting rewards!</div>
          </div>
        </div>

        {referralCode ? (
          <div className="mt-5">
            <div className="text-xs font-semibold text-slate-500 mb-2">Your Referral Code</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-sm font-mono font-bold tracking-widest text-slate-800 dark:text-slate-200">{referralCode}</span>
                <button
                  type="button"
                  onClick={() => { void navigator.clipboard.writeText(referralCode); }}
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:shadow-sm dark:hover:bg-slate-700"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8C6 15 3 17 3 17h18s-3-2-3-9z"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                Share Now
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Referrals</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">24</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l5-5 5 5M12 12V3"/></svg>
                +12 this month
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Earnings</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">GHS 120</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l5-5 5 5M12 12V3"/></svg>
                +18% this month
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rewards Claimed</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">5</div>
              <div className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                View history &rarr;
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
