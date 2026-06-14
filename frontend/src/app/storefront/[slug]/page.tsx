"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { api } from "@/lib/api";
import { getNetworkMeta } from "@/lib/network";
import { RecipientPhoneModal } from "@/components/RecipientPhoneModal";
import type { AgentStorefront, StorefrontProduct } from "@/lib/types";

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

function getNetworkColors(slug: string | null | undefined) {
  const s = String(slug || "").toLowerCase();
  if (s === "mtn") return {
    bg: "bg-yellow-400",
    bgHover: "hover:bg-yellow-500",
    bgLight: "bg-yellow-50",
    text: "text-yellow-600",
    border: "border-yellow-400",
    buttonBg: "bg-yellow-400",
    buttonText: "text-slate-900",
    price: "text-yellow-500",
    badge: "bg-yellow-200 text-yellow-800",
    activeBtn: "bg-yellow-400 text-slate-900",
    gradient: "from-yellow-400/20 to-yellow-200/10",
  };
  if (s === "telecel") return {
    bg: "bg-red-500",
    bgHover: "hover:bg-red-600",
    bgLight: "bg-red-50",
    text: "text-red-500",
    border: "border-red-500",
    buttonBg: "bg-red-500",
    buttonText: "text-white",
    price: "text-red-500",
    badge: "bg-red-200 text-red-800",
    activeBtn: "bg-red-500 text-white",
    gradient: "from-red-400/20 to-red-200/10",
  };
  if (s === "airteltigo") return {
    bg: "bg-rose-500",
    bgHover: "hover:bg-rose-600",
    bgLight: "bg-rose-50",
    text: "text-rose-500",
    border: "border-rose-500",
    buttonBg: "bg-rose-500",
    buttonText: "text-white",
    price: "text-rose-500",
    badge: "bg-rose-200 text-rose-800",
    activeBtn: "bg-rose-500 text-white",
    gradient: "from-rose-400/20 to-rose-200/10",
  };
  return {
    bg: "bg-blue-600",
    bgHover: "hover:bg-blue-700",
    bgLight: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-600",
    buttonBg: "bg-blue-600",
    buttonText: "text-white",
    price: "text-blue-600",
    badge: "bg-blue-200 text-blue-800",
    activeBtn: "bg-blue-600 text-white",
    gradient: "from-blue-400/20 to-blue-200/10",
  };
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

  function getProductBadge(index: number) {
    if (index === 0) return { text: "BEST SELLER", class: "bg-yellow-100 text-yellow-700" };
    if (index === 2) return { text: "GREAT VALUE", class: "bg-green-100 text-green-700" };
    return null;
  }

  const handlePhoneConfirm = async (recipientPhone: string) => {
    if (!selectedItem) return;
    
    setProcessingPhone(recipientPhone);
    setProcessingError(null);

    try {
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
    <div className="relative overflow-hidden bg-white min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{storefront?.title || "Emmanuel Ago"}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">DATA STORE</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/track-order" className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors group">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Track Order
            </Link>
            <Link href="#support" className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors group">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 16v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Support
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        {/* Hero Section - Rich Blue with Floating Elements */}
        <div className="relative rounded-3xl overflow-hidden mb-10 shadow-2xl" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 35%, #3b82f6 70%, #60a5fa 100%)' }}>
          {/* Floating decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-6 right-[18%] w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
              <img src="/networks/mtn.svg" alt="MTN" className="w-9 h-9" />
            </div>
            <div className="absolute top-14 right-[6%] w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }}>
              <img src="/networks/airteltigo.svg" alt="AT" className="w-7 h-7" />
            </div>
            <div className="absolute bottom-10 right-[22%] w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="absolute top-4 right-[38%] w-2 h-2 rounded-full bg-white/40"></div>
            <div className="absolute bottom-16 right-[10%] w-3 h-3 rounded-full bg-yellow-300/50"></div>
          </div>

          <div className="relative px-8 py-10 md:px-12 md:py-14 text-white">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/20 border border-yellow-400/30 px-3 py-1.5 text-xs font-bold text-yellow-300 mb-5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                FAST &bull; CHEAP &bull; INSTANT
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
                Buy Data Bundles <span className="text-yellow-300">Instantly</span>
              </h2>
              <p className="text-lg text-blue-100 mb-6">MTN &amp; AirtelTigo bundles delivered in seconds. Pay securely with MoMo.</p>
              <div className="flex gap-5 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-blue-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                  </svg>
                  100% Secure
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  Instant Delivery
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="white"/>
                    <path d="M11 7h2v6h-2z" fill="white"/>
                    <circle cx="12" cy="16" r="1" fill="white"/>
                  </svg>
                  24/7 Support
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="relative">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for bundles..."
              className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm"
            />
          </div>

          {/* Network Filter with network colors */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveNetwork("")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition shadow-sm hover:shadow-md ${
                activeNetwork === ""
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              </svg>
              All Networks
            </button>
            {networks.map((n) => {
              const meta = getNetworkMeta({ slug: n.slug, name: n.name });
              const colors = getNetworkColors(n.slug);
              const isActive = activeNetwork === n.slug;
              return (
                <button
                  key={n.slug}
                  type="button"
                  onClick={() => setActiveNetwork(n.slug)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition shadow-sm hover:shadow-md ${
                    isActive
                      ? `${colors.activeBtn}`
                      : `border border-slate-200 bg-white text-slate-600 hover:${colors.border}`
                  }`}
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
            {filteredItems.map((item, index) => {
              const product = item.product;
              const price = item.sellPrice || product.price;
              const meta = getNetworkMeta({ slug: product.category?.slug, name: product.category?.name });
              const colors = getNetworkColors(product.category?.slug);
              const badge = getProductBadge(index);
              const validityDays = product.name?.toLowerCase().includes("30") ? 30 : product.name?.toLowerCase().includes("15") ? 15 : 7;

              return (
                <div key={product.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-soft transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  {/* Badge */}
                  {badge && (
                    <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${badge.class}`}>
                      {badge.text}
                    </div>
                  )}

                  {/* Network Logo */}
                  <div className="mb-3">
                    {meta.icon ? (
                      <img src={meta.icon} alt={meta.label} className="h-10 w-10" />
                    ) : (
                      <div className={`h-10 w-10 rounded-lg ${colors.bg} flex items-center justify-center text-white font-bold text-sm`}>
                        {meta.initials}
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="mb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{meta.label}</div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">{product.name}</h3>
                    <p className="text-sm text-slate-500">Data Bundle</p>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className={`text-2xl font-extrabold ${colors.price}`}>
                      GHS {Number(price).toFixed(2)}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="mb-4 flex gap-3 flex-wrap text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                      Instant Delivery
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
                      </svg>
                      Valid {validityDays} days
                    </span>
                  </div>

                  {/* Buy Button - Network colored */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setPhoneOpen(true);
                    }}
                    disabled={processingPhone !== null}
                    className={`w-full h-11 rounded-xl font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 ${colors.buttonBg} ${colors.buttonText}`}
                  >
                    {processingPhone !== null ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Buy Now
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17 8l4 4m0 0l-4 4m4-4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {/* Features Section */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#3b82f6" stroke="#2563eb" strokeWidth="1.5"/>
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">100% Secure</h3>
            <p className="text-xs text-slate-500">Your payments are safe and protected</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="#eab308"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Instant Delivery</h3>
            <p className="text-xs text-slate-500">Bundles delivered to you in seconds</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="6" width="20" height="12" rx="2" fill="#22c55e"/>
                <circle cx="12" cy="12" r="3" fill="white"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">MoMo Payments</h3>
            <p className="text-xs text-slate-500">Pay easily with MTN MoMo and other methods</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" fill="#f43f5e"/>
                <path d="M12 8v4M12 16h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">24/7 Support</h3>
            <p className="text-xs text-slate-500">We&apos;re always here to help you</p>
          </div>
        </div>
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

      {/* WhatsApp Chat Bubble */}
      {storefront?.whatsappLink && (
        <a
          href={storefront.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600 transition-all hover:scale-110 animate-fade-in-up"
          aria-label="Chat on WhatsApp"
          title="Chat on WhatsApp"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.672-1.612-.922-2.206-.24-.583-.487-.51-.672-.51-.173-.005-.371-.005-.57-.005-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.3A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
