"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-1",
    name: "MTN Data Bundle",
    slug: "mtn-data-bundle",
    description: "Fast and reliable MTN data bundles.",
    price: "12.50",
    stock: 100,
    imageUrls: ["/product-placeholder.svg"],
    category: { id: "c1", name: "Data bundle", slug: "data-bundle" },
  },
  {
    id: "demo-2",
    name: "Telecel Data Bundle",
    slug: "telecel-data-bundle",
    description: "Affordable Telecel bundles for all needs.",
    price: "10.00",
    stock: 120,
    imageUrls: ["/product-placeholder.svg"],
    category: { id: "c1", name: "Data bundle", slug: "data-bundle" },
  },
  {
    id: "demo-3",
    name: "AFA Registration",
    slug: "afa-registration",
    description: "Quick AFA registration service.",
    price: "6.00",
    stock: 999,
    imageUrls: ["/product-placeholder.svg"],
    category: { id: "c2", name: "Subscription", slug: "subscription" },
  },
];

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

export function ProductsGrid({
  title,
  query,
}: {
  title?: string;
  query?: { q?: string; category?: string; page?: number; limit?: number };
}) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (query?.q) p.q = query.q;
    if (query?.category) p.category = query.category;
    if (query?.page) p.page = query.page;
    if (query?.limit) p.limit = query.limit;
    return p;
  }, [query?.category, query?.limit, query?.page, query?.q]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<ProductsResponse>("/products", { params });
        if (cancelled) return;
        setItems(res.data.items || []);
      } catch (e) {
        if (cancelled) return;
        setError("Failed to load products. Start the backend API and try again.");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <section>
      {title ? <h2 className="text-xl font-semibold tracking-tight">{title}</h2> : null}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(6, query?.limit || 6) }).map((_, idx) => (
            <div
              key={idx}
              className="animate-pulse rounded-3xl border border-zinc-200 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-4 h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-3 h-5 w-2/3 rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-4 h-11 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : error ? (
        <>
          <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            Live products will appear here once the backend API is running. Showing demo products for now.
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_PRODUCTS.slice(0, query?.limit || 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          No products yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
