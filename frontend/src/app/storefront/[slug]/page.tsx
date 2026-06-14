"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { api } from "@/lib/api";
import { getNetworkMeta } from "@/lib/network";
import { RecipientPhoneModal } from "@/components/RecipientPhoneModal";
import type { AgentStorefront, StorefrontProduct } from "@/lib/types";

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

function getNetworkOrder(slug: string | null | undefined): number {
  const s = String(slug || "").toLowerCase();
  if (s === "mtn") return 1;
  if (s === "telecel") return 2;
  if (s === "airteltigo") return 3;
  return 999;
}

export default function StorefrontPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [storefront, setStorefront] = useState<AgentStorefront | null>(null);
  const [items, setItems] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeNetwork, setActiveNetwork] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<StorefrontProduct | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [processingPhone, setProcessingPhone] = useState<string | null>(null);
  const [subtotal, setSubtotal] = useState<string>("0.00");
  const [processingError, setProcessingError] = useState<string | null>(null);

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
    return Array.from(map.values()).sort((a, b) => getNetworkOrder(a.slug) - getNetworkOrder(b.slug));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((item) => {
      if (!activeNetwork) return true;
      return item.product.category?.slug === activeNetwork;
    });

    if (activeNetwork === "") {
      list = list.sort((a, b) => {
        const networkOrderA = getNetworkOrder(a.product.category?.slug);
        const networkOrderB = getNetworkOrder(b.product.category?.slug);
        if (networkOrderA !== networkOrderB) return networkOrderA - networkOrderB;
        
        const ga = extractGbValue(a.product.name || "");
        const gb = extractGbValue(b.product.name || "");
        if (ga != null && gb != null && ga !== gb) return ga - gb;
        if (ga != null && gb == null) return -1;
        if (ga == null && gb != null) return 1;
        return String(a.product.name || "").localeCompare(String(b.product.name || ""));
      });
    } else {
      list = list.sort((a, b) => {
        const ga = extractGbValue(a.product.name || "");
        const gb = extractGbValue(b.product.name || "");
        if (ga != null && gb != null && ga !== gb) return ga - gb;
        if (ga != null && gb == null) return -1;
        if (ga == null && gb != null) return 1;
        return String(a.product.name || "").localeCompare(String(b.product.name || ""));
      });
    }

    if (!q) return list;
    return list.filter((item) => {
      const hay = `${item.product.name} ${item.product.slug} ${item.product.category?.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeNetwork, items, search]);

  const accent = storefront?.accentColor || "#0052CC";

  const handlePhoneConfirm = async (recipientPhone: string) => {
    if (!selectedItem) return;
    
    setProcessingPhone(recipientPhone);
    setProcessingError(null);

    try {
      const price = selectedItem.sellPrice || selectedItem.product.price;
      setSubtotal(String(price));

      const res = await api.post<{ authorizationUrl: string; reference: string; total: string }>(
        '/payments/paystack/initialize-storefront',
        {
          storefrontSlug: slug,
          items: [
            {
              productId: selectedItem.product.id,
              quantity: 1,
              recipientPhone,
            },
          ],
          callbackUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/storefront/${slug}/paystack/callback`,
          customerName: 'Guest Buyer',
          customerEmail: `guest-${Date.now()}@storefront.local`,
          customerPhone: recipientPhone,
        }
      );

      if (res.data?.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
      }
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setProcessingError(maybeError?.response?.data?.error || 'Failed to process payment. Please try again.');
      setProcessingPhone(null);
    }
  };

  return (
    <div className="relative overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-40" />
      <div
        className="pointer-events-none absolute -left-40 -top-40 -z-10 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)` }}
      />
      <div className="pointer-events-none absolute -bottom-40 -right-40 -z-10 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)` }}
      />

      {/* Header with Track Order and Support */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {storefront?.heroEmoji && <span className="text-2xl">{storefront.heroEmoji}</span>}
            <h1 className="text-xl font-bold text-slate-900">{storefront?.title || "Data Store"}</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/track-order" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor"/>
              </svg>
              Track Order
            </Link>
            <Link href="#support" className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
              </svg>
              Support
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        {/* Hero Section */}
        <div className="rounded-3xl overflow-hidden mb-12" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)` }}>
          <div className="px-8 py-12 text-white">
            <div className="flex items-center gap-2 mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              <span className="text-sm font-semibold">FAST • CHEAP • INSTANT</span>
            </div>
            <h2 className="text-4xl font-bold mb-3">Buy Data Bundles Instantly</h2>
            <p className="text-lg opacity-90 mb-6">MTN & AirtelTigo bundles delivered in seconds. Pay securely with MoMo.</p>
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
                </svg>
                <span className="text-sm">100% Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span className="text-sm">Instant Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor"/>
                </svg>
                <span className="text-sm">24/7 Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="relative">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z" fill="currentColor"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for bundles..."
              className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          {/* Network Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveNetwork("")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                activeNetwork === ""
                  ? "text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              style={activeNetwork === "" ? { backgroundColor: accent } : undefined}
            >
              All Networks
            </button>
            {networks.map((n) => {
              const meta = getNetworkMeta({ slug: n.slug, name: n.name });
              const isActive = activeNetwork === n.slug;
              return (
                <button
                  key={n.slug}
                  type="button"
                  onClick={() => setActiveNetwork(n.slug)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${
                    isActive
                      ? "text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  style={isActive ? { backgroundColor: accent } : undefined}
                >
                  {meta.icon ? <img src={meta.icon} alt={meta.label} className="h-5 w-5" /> : null}
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500 mb-4"></div>
            <p>Loading bundles...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            <p className="text-lg">No bundles found</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const product = item.product;
              const price = item.sellPrice || product.price;
              const meta = getNetworkMeta({ slug: product.category?.slug, name: product.category?.name });
              return (
                <div key={product.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition hover:shadow-md hover:-translate-y-1">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase">{meta.label}</div>
                      <div className="mt-2 text-xl font-bold text-slate-900">{product.name}</div>
                    </div>
                    {meta.icon ? <img src={meta.icon} alt={meta.label} className="h-12 w-12 flex-shrink-0" /> : null}
                  </div>

                  <div className="mb-4 flex items-baseline gap-2">
                    <div className="text-3xl font-bold" style={{ color: accent }}>
                      GHS {Number(price).toFixed(2)}
                    </div>
                  </div>

                  <div className="mb-4 flex gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                      Instant Delivery
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
                      </svg>
                      Valid 30 days
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setPhoneOpen(true);
                    }}
                    disabled={processingPhone !== null}
                    className="w-full h-11 rounded-xl text-white font-semibold transition hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    {processingPhone !== null ? 'Processing...' : 'Buy Now'}
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
        onCancel={() => {
          setPhoneOpen(false);
          setProcessingError(null);
        }}
        onConfirm={handlePhoneConfirm}
      />

      {processingError && (
        <div className="fixed bottom-4 left-4 right-4 z-40 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-md">
          {processingError}
        </div>
      )}
    </div>
  );
}
