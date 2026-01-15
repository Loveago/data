"use client";

import Link from "next/link";

import { useCart } from "@/context/CartContext";
import { getNetworkMeta } from "@/lib/network";

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

export default function CartPage() {
  const { items, subtotal, removeItem, setQuantity } = useCart();

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70 dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />
      <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-600/25 via-cyan-500/20 to-emerald-400/15 blur-3xl animate-floaty" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/20 via-blue-500/16 to-cyan-400/12 blur-3xl animate-floaty2" />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-fade-up">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-gradient-blue">Cart</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Review your items before checkout.</p>
          </div>
          {items.length ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {items.length} item{items.length === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-zinc-200/70 bg-white/80 p-10 text-center shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 animate-fade-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-soft">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6h15l-2 10H7L6 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                <path d="M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                <path d="M6 6 5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-4 text-lg font-semibold">Your cart is empty</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Add a bundle to get started.</div>
            <Link
              href="/store"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95"
            >
              Browse the store
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <div>
              <div className="space-y-4">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-soft backdrop-blur transition-all hover:-translate-y-[1px] hover:shadow-lg dark:border-zinc-800/70 dark:bg-zinc-950/70"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <NetworkBadge slug={it.categorySlug} name={it.categoryName} />
                          <div className="text-sm font-semibold text-zinc-900 dark:text-white">{formatMoney(it.price * it.quantity)}</div>
                        </div>

                        <p className="mt-3 text-base font-semibold">{it.name}</p>
                        {it.recipientPhone ? (
                          <p className="mt-1 text-xs text-zinc-500">Recipient: {it.recipientPhone}</p>
                        ) : null}

                        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{formatMoney(it.price)} each</div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">Quantity</div>
                            <div className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white/70 p-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
                              <button
                                type="button"
                                onClick={() => setQuantity(it.id, it.quantity - 1)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={it.quantity}
                                onChange={(e) => setQuantity(it.id, Number(e.target.value))}
                                className="h-9 w-16 bg-transparent text-center text-sm font-medium outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setQuantity(it.id, it.quantity + 1)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(it.id)}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white/70 px-4 text-sm font-semibold text-zinc-700 backdrop-blur transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-fit rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
                  <span className="font-semibold">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Fees</span>
                  <span className="font-semibold">{formatMoney(0)}</span>
                </div>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-zinc-900 dark:text-white">Total</span>
                  <span className="text-base font-semibold">{formatMoney(subtotal)}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95"
              >
                Proceed to Checkout
              </Link>
              <Link
                href="/store"
                className="mt-3 block text-center text-sm font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                Continue shopping
              </Link>
              <div className="mt-5 text-xs text-zinc-500">Secure checkout powered by Paystack.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
