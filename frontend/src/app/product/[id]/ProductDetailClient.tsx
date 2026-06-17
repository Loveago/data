"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { RecipientPhoneModal } from "@/components/RecipientPhoneModal";

function formatPrice(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

type ReferralProduct = Product & {
  basePrice?: string;
  referralPrice?: string | null;
  effectivePrice?: string;
  isReferralPrice?: boolean;
};

export default function ProductDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [product, setProduct] = useState<ReferralProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  const safeQty = useMemo(() => Math.max(1, Math.floor(quantity)), [quantity]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isAuthenticated) {
          const res = await api.get<{ items: ReferralProduct[] }>("/referral-pricing/my-products");
          if (cancelled) return;
          const products = res.data.items || [];
          const found = products.find((p) => p.id === id || p.slug === id);
          if (found) {
            setProduct({ ...found, price: found.effectivePrice || found.price });
          } else {
            setError("Product not found.");
            setProduct(null);
          }
        } else {
          const res = await api.get<Product>(`/products/${id}`);
          if (cancelled) return;
          setProduct(res.data);
        }
      } catch {
        if (cancelled) return;
        setError("Product not found.");
        setProduct(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error || "Unable to load product."}
        </div>
      </div>
    );
  }

  const img = product.imageUrls?.[0];
  // product.price is already set to effectivePrice by parent for authenticated users
  const resolvedPrice = product.price;
  const resolvedPriceNum = Number(resolvedPrice);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-900">
            {img ? (
              <img src={img} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">No image</div>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-zinc-500">{product.category?.name}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
          {product.isReferralPrice && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L15 8.5L22 9.5L17 14.5L18.5 22L12 18.5L5.5 22L7 14.5L2 9.5L9 8.5L12 2Z" fill="currentColor" stroke="none"/>
              </svg>
              Referral Price
            </div>
          )}
          <p className="mt-3 text-xl font-semibold">{formatPrice(String(resolvedPrice))}</p>

          <div className="mt-6 flex items-center gap-3">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Quantity</label>
            <input
              type="number"
              min={1}
              value={safeQty}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="h-11 w-28 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setPhoneOpen(true)}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Add to Cart
          </button>

          <RecipientPhoneModal
            open={phoneOpen}
            product={product}
            priceOverride={resolvedPrice}
            onCancel={() => setPhoneOpen(false)}
            onConfirm={(recipientPhone) => {
              addItem(product, safeQty, recipientPhone, Number.isFinite(resolvedPriceNum) ? resolvedPriceNum : undefined);
              setPhoneOpen(false);
              router.push("/cart");
            }}
          />

          <div className="mt-8">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {product.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
