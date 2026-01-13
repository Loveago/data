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
  const { items, subtotal, clear } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>(user?.walletBalance || "0");
  const [paystackFee, setPaystackFee] = useState<number>(0);
  const [paystackTotal, setPaystackTotal] = useState<number>(subtotal);

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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Enter your details and complete payment.</p>
        </div>
        <Link href="/cart" className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
          Back to cart
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Your details</h2>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">We’ll use these details for your receipt.</div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">Payment</div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Choose how you want to pay.</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Wallet balance</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{formatMoney(walletBalanceNumber || 0)}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => payWithPaystack()}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {submitting ? "Redirecting to Paystack..." : "Pay with Paystack"}
            </button>

            <button
              type="button"
              disabled={submitting || !canPayWithWallet}
              onClick={() => payWithWallet()}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {submitting ? "Processing..." : `Pay with Balance (${formatMoney(walletBalanceNumber || 0)})`}
            </button>

            {!canPayWithWallet ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                Wallet balance is insufficient. Deposit funds on your <Link href="/dashboard" className="font-semibold underline">dashboard</Link> or pay with Paystack.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{items.length} item{items.length === 1 ? "" : "s"}</div>

          <div className="mt-5 space-y-4">
            {items.map((it) => (
              <div key={it.id} className="rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <NetworkBadge slug={it.categorySlug} name={it.categoryName} />
                      <div className="text-xs text-zinc-500">x{it.quantity}</div>
                    </div>
                    <div className="mt-2 truncate font-semibold text-zinc-900 dark:text-white">{it.name}</div>
                    {it.recipientPhone ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Recipient: {it.recipientPhone}</div> : null}
                  </div>
                  <div className="shrink-0 font-semibold text-zinc-900 dark:text-white">{formatMoney(it.price * it.quantity)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span className="font-semibold">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Fees</span>
              <span className="font-semibold">{formatMoney(paystackFee)}</span>
            </div>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center justify-between">
              <span className="text-zinc-900 dark:text-white">Total</span>
              <span className="text-base font-semibold">{formatMoney(paystackTotal)}</span>
            </div>
          </div>
          <div className="mt-5 text-xs text-zinc-500">Secure checkout powered by Paystack.</div>
        </div>
      </div>
    </div>
  );
}
