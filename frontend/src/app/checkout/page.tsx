"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getNetworkMeta } from "@/lib/network";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

function NetworkBadge({ slug, name }: { slug?: string; name?: string }) {
  const meta = getNetworkMeta({ slug, name });
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
      <span className={`relative inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ${meta.badgeClass}`}>
        <span className="relative z-10">{meta.initials}</span>
        {meta.icon ? <img src={meta.icon} alt="" className="absolute inset-0 h-full w-full object-contain opacity-90" /> : null}
      </span>
      <span>{meta.label}</span>
    </div>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { items, subtotal, clear, removeItem, setQuantity } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>(user?.walletBalance || "0");
  const [paystackFee, setPaystackFee] = useState<number>(0);
  const [paystackTotal, setPaystackTotal] = useState<number>(subtotal);

  useEffect(() => {
    if (!user) return;
    setCustomerName((v) => v || user.name || "");
    setCustomerEmail((v) => v || user.email || "");
    setCustomerPhone((v) => v || user.phone || "");
  }, [user]);

  const orderItems = useMemo(
    () => items.map((it) => ({ productId: it.productId, quantity: it.quantity, recipientPhone: it.recipientPhone })),
    [items]
  );

  const walletBalanceNumber = useMemo(() => Number(walletBalance), [walletBalance]);
  const canPayWithWallet = Number.isFinite(walletBalanceNumber) && walletBalanceNumber >= subtotal;

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      try {
        const res = await api.post<{ subtotal: string; fee: string; total: string }>("/payments/paystack/quote", {
          items: orderItems,
        });
        if (cancelled) return;
        const fee = Number(res.data?.fee);
        const total = Number(res.data?.total);
        setPaystackFee(Number.isFinite(fee) ? fee : 0);
        setPaystackTotal(Number.isFinite(total) ? total : subtotal);
      } catch {
        if (cancelled) return;
        setPaystackFee(0);
        setPaystackTotal(subtotal);
      }
    }

    if (isAuthenticated && orderItems.length > 0) {
      loadQuote();
    } else {
      setPaystackFee(0);
      setPaystackTotal(subtotal);
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, orderItems, subtotal]);

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

  async function payWithPaystack() {
    setSubmitting(true);
    setError(null);
    try {
      const callbackUrl = `${window.location.origin}/checkout/paystack`;
      const res = await api.post("/payments/paystack/initialize", {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        items: orderItems,
        callbackUrl,
      });

      const authorizationUrl = res.data?.authorizationUrl;
      const reference = res.data?.reference;
      if (!authorizationUrl) throw new Error("Missing authorizationUrl");
      if (reference) {
        window.sessionStorage.setItem(
          "gigshub_paystack_pending",
          JSON.stringify({
            reference,
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            items: orderItems,
          })
        );
      }
      window.location.href = authorizationUrl;
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Failed to place order.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function payWithWallet() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/orders/wallet", {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        items: orderItems,
      });

      const label = res.data?.orderCode || res.data?.id;
      clear();
      router.push(`/dashboard?order=${encodeURIComponent(label)}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Failed to place order.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Sign in to complete your order.</p>
          </div>
          <Link href="/cart" className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
            Back to cart
          </Link>
        </div>
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-lg font-semibold">You need to login</div>
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Login to pay with Paystack or your wallet balance.</div>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No items to checkout.</p>
          </div>
          <Link href="/store" className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
            Browse store
          </Link>
        </div>
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-lg font-semibold">Your cart is empty</div>
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Add a bundle before checking out.</div>
          <Link
            href="/store"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Go to store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shopping Cart</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {items.length} item{items.length === 1 ? "" : "s"} in your cart
          </p>
        </div>
        <Link href="/store" className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
          Continue shopping
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {items.map((it) => {
              const meta = getNetworkMeta({ slug: it.categorySlug, name: it.categoryName });
              return (
                <div key={it.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                        {meta.icon ? <img src={meta.icon} alt="" className="h-10 w-10 object-contain" /> : <span className="text-sm font-bold">{meta.initials}</span>}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-zinc-900 dark:text-white">{it.name}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {String(it.categorySlug || meta.label).toLowerCase()} {it.recipientPhone ? `• ${it.recipientPhone}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
                            <button
                              type="button"
                              onClick={() => setQuantity(it.id, it.quantity - 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <div className="h-9 w-10 select-none text-center text-sm font-semibold leading-9 text-zinc-900 dark:text-white">
                              {it.quantity}
                            </div>
                            <button
                              type="button"
                              onClick={() => setQuantity(it.id, it.quantity + 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-3">
                      <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatMoney(it.price * it.quantity)}</div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <details open className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-900 dark:text-white">Customer details</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Full name</div>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</div>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Phone</div>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0240000000"
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Address</div>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Optional"
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </div>
            </div>
          </details>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order Summary</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span className="text-zinc-700 dark:text-zinc-200">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Service Fee (2%)</span>
              <span className="text-zinc-700 dark:text-zinc-200">{formatMoney(paystackFee)}</span>
            </div>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center justify-between">
              <span className="text-zinc-900 dark:text-white">Total</span>
              <span className="text-base font-semibold text-zinc-900 dark:text-white">{formatMoney(paystackTotal)}</span>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={submitting || !canPayWithWallet}
            onClick={() => payWithWallet()}
            className={
              canPayWithWallet
                ? "mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                : "mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-200 text-sm font-semibold text-zinc-500 disabled:opacity-100 dark:bg-zinc-900 dark:text-zinc-500"
            }
          >
            Pay with Wallet
          </button>

          <div className="mt-3 flex items-center justify-between text-xs">
            <div className={canPayWithWallet ? "text-emerald-600" : "text-red-600"}>Balance: {formatMoney(walletBalanceNumber || 0)}</div>
            {!canPayWithWallet ? (
              <div className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-300">INSUFFICIENT</div>
            ) : (
              <div className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">AVAILABLE</div>
            )}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <div className="text-[10px] font-semibold text-zinc-500">OR PAY WITH</div>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => payWithPaystack()}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-600 bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500 dark:bg-zinc-950 dark:text-blue-300 dark:hover:bg-zinc-900"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {submitting ? "Redirecting..." : "Paystack MoMo"}
          </button>
          <div className="mt-2 text-center text-[11px] text-zinc-500">+ {formatMoney(paystackFee)} fee</div>

          <div className="mt-5 text-center text-xs font-semibold text-zinc-500">
            MTN MoMo <span className="mx-2">•</span> Telecel Cash <span className="mx-2">•</span> AT-Money
          </div>
        </div>
      </div>
    </div>
  );
}
