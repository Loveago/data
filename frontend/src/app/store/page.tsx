"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-1",
    name: "MTN 1GB Data Bundle",
    slug: "mtn-1gb",
    description: "MTN 1GB data bundle.",
    price: "4.50",
    stock: 100,
    imageUrls: ["/product-placeholder.svg"],
    category: { id: "c1", name: "MTN", slug: "mtn" },
  },
  {
    id: "demo-2",
    name: "Telecel 2GB Data Bundle",
    slug: "telecel-2gb",
    description: "Telecel 2GB data bundle.",
    price: "9.00",
    stock: 120,
    imageUrls: ["/product-placeholder.svg"],
    category: { id: "c2", name: "Telecel", slug: "telecel" },
  },
  {
    id: "demo-3",
    name: "AT 3GB Data Bundle",
    slug: "airteltigo-3gb",
    description: "AT 3GB data bundle.",
    price: "13.60",
    stock: 999,
    imageUrls: ["/product-placeholder.svg"],
    category: { id: "c3", name: "AT iShare", slug: "airteltigo" },
  },
];

type Category = { id: string; name: string; slug: string };

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

type NetworkCard = {
  slug: string;
  name: string;
  logo: string;
  gradient: string;
  accent: string;
};

function extractGbValue(name: string) {
  const m = /(\d+(?:\.\d+)?)\s*gb/i.exec(String(name || ''));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export default function StorePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [networkCounts, setNetworkCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const res = await api.get<{ items: Category[] }>("/categories");
        if (!cancelled) setCategories(res.data.items || []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  const networks = useMemo<NetworkCard[]>(() => {
    return [
      {
        slug: "mtn",
        name: "MTN",
        logo: "/networks/mtn.svg",
        gradient: "bg-gradient-to-r from-yellow-400 to-amber-600",
        accent: "text-yellow-900",
      },
      {
        slug: "airteltigo",
        name: "AT iShare",
        logo: "/networks/airteltigo.svg",
        gradient: "bg-gradient-to-r from-sky-500 to-blue-700",
        accent: "text-blue-50",
      },
      {
        slug: "telecel",
        name: "Telecel",
        logo: "/networks/telecel-logo.svg",
        gradient: "bg-gradient-to-r from-rose-500 to-red-700",
        accent: "text-rose-50",
      },
    ];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      try {
        const res = await Promise.all(
          networks.map(async (n) => {
            const r = await api.get<ProductsResponse>("/products", { params: { category: n.slug, limit: 1 } });
            return [n.slug, r.data.total || 0] as const;
          })
        );
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const [k, v] of res) map[k] = v;
        setNetworkCounts(map);
      } catch {
        if (!cancelled) setNetworkCounts({});
      }
    }

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [networks]);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { limit: 200 };
    if (q.trim()) p.q = q.trim();
    if (category) p.category = category;
    return p;
  }, [category, q]);

  const sortedItems = useMemo(() => {
    const next = [...items];
    next.sort((a, b) => {
      const ga = extractGbValue(a.name);
      const gb = extractGbValue(b.name);
      if (ga != null && gb != null && ga !== gb) return ga - gb;
      if (ga != null && gb == null) return -1;
      if (ga == null && gb != null) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return next;
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<ProductsResponse>("/products", { params });
        if (cancelled) return;
        setItems(res.data.items || []);
      } catch {
        if (cancelled) return;
        setError("Failed to load products.");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-wash" />

      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stores</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Browse premium data packages from Ghana&apos;s leading telecom providers
          </p>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-soft hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/40">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </span>
              Agent Pricing
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {networks.map((n, idx) => (
            <div
              key={n.slug}
              className={`group relative overflow-hidden rounded-3xl ${n.gradient} p-[1px] shadow-soft transition hover:-translate-y-[2px] hover:shadow-lg ${
                idx % 2 === 0 ? "animate-floaty" : "animate-floaty2"
              }`}
            >
              <div className="relative rounded-3xl bg-white/15 p-6 backdrop-blur dark:bg-black/15">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                      <img src={n.logo} alt={n.name} className="h-10 w-10 object-contain" />
                    </div>
                    <div>
                      <div className={`text-lg font-semibold ${n.accent}`}>{n.name}</div>
                      <div className={`mt-1 text-xs ${n.accent} opacity-90`}>60 Days</div>
                      <div className={`mt-2 inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs ${n.accent}`}
                      >
                        {(networkCounts[n.slug] || 0) + " packages"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCategory(n.slug);
                      const el = document.getElementById("packages");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-black/5 transition hover:bg-zinc-50"
                  >
                    View
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div id="packages" className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Packages</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {category ? `Showing ${category.toUpperCase()} bundles` : "Select a network above to view bundles"}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:max-w-xl md:flex-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search packages..."
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              >
                <option value="">All networks</option>
                {categories
                  .filter((c) => ["mtn", "telecel", "airteltigo"].includes(c.slug))
                  .map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Loading...
            </div>
          ) : error ? (
            <>
              <div className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-6 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                Backend is not running yet. Showing demo products so you can preview the UI.
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {DEMO_PRODUCTS.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          ) : items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              No products found.
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
