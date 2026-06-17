"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type ReferralPrice = {
  id: string | null;
  productId: string;
  productName: string;
  productSlug: string;
  category: { name: string; slug: string } | null;
  basePrice: string;
  referralPrice: string | null;
  markup: string | null;
  hasReferralPrice: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export function ReferralPricing() {
  const [referralPrices, setReferralPrices] = useState<ReferralPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPrice, setSelectedPrice] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    loadReferralPrices();
  }, []);

  async function loadReferralPrices() {
    setLoading(true);
    setError(null);
    try {
      console.log("[ReferralPricing] Loading referral prices...");
      const res = await api.get<{ referralPrices: ReferralPrice[] }>("/referral-pricing/my-referral-pricing");
      console.log("[ReferralPricing] Loaded", res.data.referralPrices?.length || 0, "products");
      const withPrices = res.data.referralPrices?.filter((p) => p.hasReferralPrice) || [];
      console.log("[ReferralPricing] Products with referral prices:", withPrices.length);
      setReferralPrices(res.data.referralPrices || []);
    } catch (err: any) {
      console.error("[ReferralPricing] Error loading", err);
      setError(err?.response?.data?.error || "Failed to load referral pricing");
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    if (products.length > 0) return;
    setProductsLoading(true);
    try {
      const res = await api.get<{ products: any[] }>("/products");
      setProducts(res.data.products || []);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setProductsLoading(false);
    }
  }

  async function handleAddPrice() {
    if (!selectedProductId || !selectedPrice) {
      setError("Please select a product and enter a price");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      console.log("[ReferralPricing] Setting price for product", selectedProductId, "to", selectedPrice);
      const res = await api.post("/referral-pricing/set-referral-price", {
        productId: selectedProductId,
        price: selectedPrice,
      });
      console.log("[ReferralPricing] Price set successfully", res.data);
      await loadReferralPrices();
      setSelectedProductId("");
      setSelectedPrice("");
      setShowAddForm(false);
    } catch (err: any) {
      console.error("[ReferralPricing] Error setting price", err);
      setError(err?.response?.data?.error || "Failed to set referral price");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePrice(id: string) {
    if (!confirm("Are you sure you want to delete this referral price?")) return;

    try {
      await api.delete(`/referral-pricing/referral-price/${id}`);
      await loadReferralPrices();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to delete referral price");
    }
  }

  return (
    <div className="space-y-4">
      <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/18 via-blue-400/12 to-cyan-400/10 blur-2xl" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Referral Pricing</div>
            <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Set Custom Prices for Referrals</div>
            <div className="mt-1 text-sm text-zinc-500">
              Set custom prices for your referrals. They will see these prices instead of your base prices when making purchases.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) loadProducts();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-all dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Price
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="mt-6 space-y-4 p-4 rounded-2xl border border-indigo-200/50 bg-indigo-50/30 dark:border-indigo-800/30 dark:bg-indigo-950/10">
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsLoading}
                className="mt-1.5 w-full rounded-xl border border-zinc-200/70 bg-white px-3 py-2 text-sm dark:border-zinc-800/70 dark:bg-zinc-950/50"
              >
                <option value="">
                  {productsLoading ? "Loading products..." : "Select a product"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category?.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Price (GHS)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
                placeholder="Enter price"
                className="mt-1.5 w-full rounded-xl border border-zinc-200/70 bg-white px-3 py-2 text-sm dark:border-zinc-800/70 dark:bg-zinc-950/50"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddPrice}
                disabled={submitting || !selectedProductId || !selectedPrice}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {submitting ? "Setting..." : "Set Price"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedProductId("");
                  setSelectedPrice("");
                }}
                className="flex-1 rounded-xl border border-zinc-200/70 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-950/50 dark:text-zinc-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-950/70">
          Loading referral prices...
        </div>
      ) : referralPrices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/50 p-6 text-center dark:border-zinc-800/70 dark:bg-zinc-950/30">
          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No products available</div>
          <div className="mt-1 text-xs text-zinc-500">
            Contact admin to add products.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white/80 dark:border-zinc-800/70 dark:bg-zinc-950/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Admin Base Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Your Referral Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Markup</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {referralPrices.map((rp) => (
                <tr key={rp.productId} className={`border-b border-zinc-100 dark:border-zinc-800/50 transition-colors ${rp.hasReferralPrice ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30' : 'bg-zinc-50/30 dark:bg-zinc-900/20'}`}>
                  <td className="px-4 py-3 font-medium">{rp.productName}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{rp.category?.name || "-"}</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">{formatMoney(rp.basePrice)}</td>
                  <td className="px-4 py-3 text-right">
                    {rp.hasReferralPrice ? (
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        {formatMoney(rp.referralPrice!)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 italic">Using base price</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rp.hasReferralPrice && rp.markup ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        +{formatMoney(rp.markup)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rp.hasReferralPrice && rp.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePrice(rp.id!)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductId(rp.productId);
                          setSelectedPrice(rp.basePrice);
                          setShowAddForm(true);
                          loadProducts();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/20 transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Set Price
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
