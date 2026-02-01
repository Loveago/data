"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getNetworkMeta } from "@/lib/network";
import { useStorefrontCart } from "@/context/StorefrontCartContext";

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export default function StorefrontCheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params?.slug || "");

  const { items, subtotal, clear, removeItem, setQuantity } = useStorefrontCart();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paystackFee, setPaystackFee] = useState<number>(0);
  const [paystackTotal, setPaystackTotal] = useState<number>(subtotal);

  const orderItems = useMemo(
    () => items.map((it) => ({ productId: it.productId, quantity: it.quantity, recipientPhone: it.recipientPhone })),
    [items]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      try {
        const res = await api.post<{ subtotal: string; fee: string; total: string }>("/payments/paystack/quote-storefront", {
          items: orderItems,
          storefrontSlug: slug,
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

    if (orderItems.length > 0 && slug) {
      loadQuote();
    } else {
      setPaystackFee(0);
      setPaystackTotal(subtotal);
    }

    return () => {
      cancelled = true;
    };
  }, [orderItems, slug, subtotal]);

  async function payWithPaystack() {
    setSubmitting(true);
    setError(null);
    try {
      if (!customerName || !customerEmail || !customerPhone) {
        setError("Please fill your name, email, and phone number.");
        return;
      }
      const callbackUrl = `${window.location.origin}/storefront/${slug}/paystack`;
      const res = await api.post("/payments/paystack/initialize-storefront", {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        items: orderItems,
        callbackUrl,
        storefrontSlug: slug,
      });

      const authorizationUrl = res.data?.authorizationUrl;
      const reference = res.data?.reference;
      if (!authorizationUrl) throw new Error("Missing authorizationUrl");
      if (reference) {
        window.sessionStorage.setItem(
          `gigshub_storefront_paystack_pending:${slug}`,
          JSON.stringify({
            reference,
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            storefrontSlug: slug,
          })
        );
      }
      window.location.href = authorizationUrl;
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-soft">
          <div className="text-lg font-semibold">Your storefront cart is empty</div>
          <div className="mt-2 text-sm text-zinc-600">Add a bundle before checking out.</div>
          <Link
            href={`/storefront/${slug}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            Go back to store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
          <p className="mt-1 text-sm text-zinc-600">{items.length} item{items.length === 1 ? "" : "s"} ready to purchase</p>
        </div>
        <Link href={`/storefront/${slug}`} className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">
          Continue shopping
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {items.map((it) => {
              const meta = getNetworkMeta({ slug: it.categorySlug, name: it.categoryName });
              return (
                <div key={it.id} className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/5">
                        {meta.icon ? <img src={meta.icon} alt="" className="h-10 w-10 object-contain" /> : <span className="text-sm font-bold">{meta.initials}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold text-zinc-900">{it.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {String(it.categorySlug || meta.label).toLowerCase()} {it.recipientPhone ? `• ${it.recipientPhone}` : ""}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white/70 p-1">
                            <button
                              type="button"
                              onClick={() => setQuantity(it.id, it.quantity - 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-zinc-100"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <div className="h-9 w-10 select-none text-center text-sm font-semibold leading-9 text-zinc-900">{it.quantity}</div>
                            <button
                              type="button"
                              onClick={() => setQuantity(it.id, it.quantity + 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-zinc-100"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-3">
                      <div className="text-sm font-semibold text-blue-700">{formatMoney(it.price * it.quantity)}</div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <details open className="mt-6 rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur">
            <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-900">Customer details</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-zinc-600">Full name</div>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="mt-2 h-11 w-full rounded-2xl border border-zinc-200 bg-white/70 px-4 text-sm outline-none backdrop-blur transition-all focus:border-blue-400"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-600">Email</div>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="mt-2 h-11 w-full rounded-2xl border border-zinc-200 bg-white/70 px-4 text-sm outline-none backdrop-blur transition-all focus:border-blue-400"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-600">Phone</div>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0240000000"
                  className="mt-2 h-11 w-full rounded-2xl border border-zinc-200 bg-white/70 px-4 text-sm outline-none backdrop-blur transition-all focus:border-blue-400"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-600">Address</div>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Optional"
                  className="mt-2 h-11 w-full rounded-2xl border border-zinc-200 bg-white/70 px-4 text-sm outline-none backdrop-blur transition-all focus:border-blue-400"
                />
              </div>
            </div>
          </details>
        </div>

        <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-soft backdrop-blur lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order Summary</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span className="text-zinc-700">{formatMoney(subtotal)}</span>
            </div>
            {paystackFee > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Paystack Fee</span>
                <span className="text-zinc-700">{formatMoney(paystackFee)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-zinc-900">Total</span>
              <span className="text-base font-semibold text-zinc-900">{formatMoney(paystackTotal)}</span>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : null}

          <button
            type="button"
            disabled={submitting}
            onClick={() => payWithPaystack()}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white/80 text-sm font-semibold text-blue-700 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-blue-50 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? "Redirecting..." : "Paystack MoMo"}
          </button>

          <div className="mt-5 text-center text-xs font-semibold text-zinc-500">MTN MoMo • Telecel Cash • AT-Money</div>
        </div>
      </div>
    </div>
  );
}
