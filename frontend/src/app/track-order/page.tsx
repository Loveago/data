"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface OrderDetails {
  id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: string;
  total: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    product: { name: string; slug: string };
  }>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED")
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">COMPLETED</span>;
  if (status === "PROCESSING")
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">PROCESSING</span>;
  if (status === "PENDING")
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">PENDING</span>;
  return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{status}</span>;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">PAID</span>;
  if (status === "UNPAID")
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">UNPAID</span>;
  return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{status}</span>;
}

export default function TrackOrderPage() {
  const [searchMode, setSearchMode] = useState<"orderCode" | "phone">("orderCode");
  const [orderCode, setOrderCode] = useState("");
  const [phone, setPhone] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (searchMode === "orderCode" && !orderCode.trim()) {
      setError("Please enter an order ID");
      return;
    }
    if (searchMode === "phone" && !phone.trim()) {
      setError("Please enter a phone number");
      return;
    }
    if (!orderDate) {
      setError("Please select an order date");
      return;
    }

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const params = new URLSearchParams();
      params.set("date", orderDate);
      if (searchMode === "orderCode") {
        params.set("orderCode", orderCode.trim());
      } else {
        params.set("phone", phone.trim().replace(/\D/g, ""));
      }

      const res = await api.get<{ order: OrderDetails }>(`/orders/track?${params.toString()}`);
      setOrder(res.data.order);
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Order not found. Please check your details and date.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="mx-auto max-w-lg">
        {/* Hero / Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
              <path d="M12 8v4l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Track Your Order</h1>
          <p className="text-sm text-slate-500">Check your bundle delivery status</p>
        </div>

        {/* Search Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl mb-6">
          {/* Toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => { setSearchMode("orderCode"); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition ${
                searchMode === "orderCode"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Order ID
            </button>
            <button
              type="button"
              onClick={() => { setSearchMode("phone"); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition ${
                searchMode === "phone"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Phone Number
            </button>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            {searchMode === "orderCode" ? (
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Order ID</label>
                <input
                  type="text"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  placeholder="e.g., STORE-ABC123DEF456"
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white"
                />
                <p className="text-xs text-slate-400 mt-1">Starts with STORE- or DASH-</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 0240000000"
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white"
                />
                <p className="text-xs text-slate-400 mt-1">Phone used during checkout</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1.5">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Searching...
                </span>
              ) : (
                "Track Order"
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {order && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Order Header Card */}
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order ID</p>
                  <p className="text-xl font-black text-emerald-600 font-mono tracking-wider">{order.orderCode}</p>
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  <StatusBadge status={order.status} />
                  <PaymentBadge status={order.paymentStatus} />
                </div>
              </div>
              <div className="text-sm text-slate-500">{formatDate(order.createdAt)}</div>

              <div className="mt-3 pt-3 border-t border-slate-100 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-semibold text-slate-800">{order.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-semibold text-slate-800">{order.customerEmail}</span>
                </div>
              </div>
            </div>

            {/* Items Card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Items</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="#3b82f6"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.product.name}</p>
                        <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">GHS {Number(item.lineTotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Total Paid</span>
                <span className="text-xl font-black text-blue-600">GHS {Number(order.total).toFixed(2)}</span>
              </div>
            </div>

            {/* Next Steps */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Status Guide</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0 text-amber-500">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span><strong>PENDING</strong> — Your order is being processed</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0 text-blue-500">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span><strong>PROCESSING</strong> — Bundle delivery is in progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0 text-emerald-500">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span><strong>COMPLETED</strong> — Data bundle delivered successfully</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!order && !loading && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-soft">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">Enter your details above</p>
            <p className="text-xs text-slate-400 mt-1">Search by Order ID or Phone Number</p>
          </div>
        )}

        {/* Back to Store */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
