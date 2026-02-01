"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { api } from "@/lib/api";
import { getNetworkMeta } from "@/lib/network";
import { RecipientPhoneModal } from "@/components/RecipientPhoneModal";
import type { AgentStorefront, StorefrontProduct } from "@/lib/types";
import { useStorefrontCart } from "@/context/StorefrontCartContext";

function formatGhs(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `GHS ${value}`;
  return `GHS ${n.toFixed(2)}`;
}

function extractGbValue(name: string) {
  const m = /(\d+(?:\.\d+)?)\s*gb/i.exec(String(name || ""));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export default function StorefrontPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const { items: cartItems, count, subtotal, addItem } = useStorefrontCart();

  const [storefront, setStorefront] = useState<AgentStorefront | null>(null);
  const [items, setItems] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeNetwork, setActiveNetwork] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<StorefrontProduct | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ storefront: AgentStorefront; items: StorefrontProduct[] }>(`/agent-storefront/public/${slug}`);
        if (cancelled) return;
        setStorefront(res.data.storefront || null);
        setItems(res.data.items || []);
      } catch (e: unknown) {
        if (cancelled) return;
        const maybeError = e as { response?: { data?: { error?: string } } };
        setError(maybeError?.response?.data?.error || "Failed to load storefront.");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (slug) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const networks = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    for (const item of items) {
      const cat = item.product?.category;
      if (!cat) continue;
      map.set(cat.slug, { slug: cat.slug, name: cat.name });
    }
    return Array.from(map.values());
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((item) => {
      if (!activeNetwork) return true;
      return item.product.category?.slug === activeNetwork;
    });

    const sorted = [...list].sort((a, b) => {
      const ga = extractGbValue(a.product.name || "");
      const gb = extractGbValue(b.product.name || "");
      if (ga != null && gb != null && ga !== gb) return ga - gb;
      if (ga != null && gb == null) return -1;
      if (ga == null && gb != null) return 1;
      return String(a.product.name || "").localeCompare(String(b.product.name || ""));
    });

    if (!q) return sorted;
    return sorted.filter((item) => {
      const hay = `${item.product.name} ${item.product.slug} ${item.product.category?.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeNetwork, items, search]);

  const accent = storefront?.accentColor || "#1d4ed8";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70" />
      <div
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)` }}
      />
      <div className="pointer-events-none absolute -bottom-28 -right-24 -z-10 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/20 via-blue-500/16 to-cyan-400/12 blur-3xl" />

      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Agent Storefront</div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
                {storefront?.heroEmoji ? <span className="mr-2">{storefront.heroEmoji}</span> : null}
                Welcome to {storefront?.title || "this"} Store
              </h1>
              <p className="mt-2 text-sm text-zinc-600">{storefront?.welcomeMessage || "Choose a bundle and purchase instantly."}</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-500">Your cart</div>
              <div className="mt-2 text-lg font-semibold" style={{ color: accent }}>
                {formatGhs(subtotal)}
              </div>
              <div className="text-xs text-zinc-500">{count} items</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bundles..."
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-white/80 px-4 text-sm outline-none backdrop-blur transition-all focus:border-blue-400"
            />
            <Link
              href={`/storefront/${slug}/checkout`}
              className="inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: accent }}
            >
              Checkout
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveNetwork("")}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              activeNetwork === ""
                ? "border-transparent text-white"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
            style={activeNetwork === "" ? { backgroundColor: accent } : undefined}
          >
            All networks
          </button>
          {networks.map((n) => {
            const meta = getNetworkMeta({ slug: n.slug, name: n.name });
            const isActive = activeNetwork === n.slug;
            return (
              <button
                key={n.slug}
                type="button"
                onClick={() => setActiveNetwork(n.slug)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  isActive ? "border-transparent text-white" : "border-zinc-200 bg-white text-zinc-700"
                }`}
                style={isActive ? { backgroundColor: accent } : undefined}
              >
                {meta.icon ? <img src={meta.icon} alt={meta.label} className="h-4 w-4" /> : null}
                {meta.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Loading bundles...</div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">No bundles found.</div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const product = item.product;
              const price = item.sellPrice || product.price;
              const meta = getNetworkMeta({ slug: product.category?.slug, name: product.category?.name });
              return (
                <div key={product.id} className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-soft transition hover:-translate-y-[2px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-zinc-500">{meta.label}</div>
                      <div className="mt-2 text-lg font-bold text-zinc-900">{product.name}</div>
                    </div>
                    {meta.icon ? <img src={meta.icon} alt={meta.label} className="h-10 w-10" /> : null}
                  </div>
                  <div className="mt-4 text-sm text-zinc-500">Price</div>
                  <div className="mt-1 text-2xl font-semibold" style={{ color: accent }}>
                    {formatGhs(price)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setPhoneOpen(true);
                    }}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
                    style={{ backgroundColor: accent }}
                  >
                    Purchase bundle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecipientPhoneModal
        open={phoneOpen}
        product={selectedItem?.product || null}
        priceOverride={selectedItem?.sellPrice || selectedItem?.product.price}
        onCancel={() => setPhoneOpen(false)}
        onConfirm={(recipientPhone) => {
          if (!selectedItem) return;
          addItem(selectedItem.product, 1, recipientPhone, Number(selectedItem.sellPrice || selectedItem.product.price));
          setPhoneOpen(false);
        }}
      />

      {cartItems.length > 0 ? (
        <div className="fixed bottom-4 left-0 right-0 z-20 px-4">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 shadow-soft backdrop-blur">
            <div>
              <div className="text-xs text-zinc-500">Cart total</div>
              <div className="text-base font-semibold">{formatGhs(subtotal)}</div>
            </div>
            <Link
              href={`/storefront/${slug}/checkout`}
              className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              Checkout ({count})
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
