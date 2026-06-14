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
    product: {
      name: string;
      slug: string;
    };
  }>;
}

export default function TrackOrderPage() {
  const [orderCode, setOrderCode] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderCode.trim()) {
      setError("Please enter an order ID");
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
      const res = await api.get<{ order: OrderDetails }>(
        `/orders/track?orderCode=${encodeURIComponent(orderCode.trim())}&date=${encodeURIComponent(orderDate)}`
      );
      setOrder(res.data.order);
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Order not found. Please check your order ID and date.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "text-green-600 bg-green-50";
      case "PROCESSING":
        return "text-blue-600 bg-blue-50";
      case "PENDING":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "text-green-600 bg-green-50";
      case "UNPAID":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Track Your Order</h1>
          <p className="text-slate-600">Enter your order ID and date to check the status of your order</p>
        </div>

        {/* Search Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-soft mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Order ID
              </label>
              <input
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder="e.g., STORE-ABC123DEF456"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
              <p className="text-xs text-slate-500 mt-1">
                Your order ID starts with STORE- (storefront) or DASH- (dashboard)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-soft hover:shadow-md transition-all disabled:opacity-50"
            >
              {loading ? "Searching..." : "Track Order"}
            </button>
          </form>
        </div>

        {/* Order Details */}
        {order && (
          <div className="space-y-6">
            {/* Order Header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{order.orderCode}</h2>
                  <p className="text-sm text-slate-600 mt-1">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getPaymentStatusColor(order.paymentStatus)}`}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Customer Information</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Name</p>
                    <p className="font-medium text-slate-900">{order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Email</p>
                    <p className="font-medium text-slate-900">{order.customerEmail}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Phone</p>
                    <p className="font-medium text-slate-900">{order.customerPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Order Items</h3>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">GHS {Number(item.lineTotal).toFixed(2)}</p>
                      <p className="text-xs text-slate-600">@ GHS {Number(item.unitPrice).toFixed(2)} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">GHS {Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-lg font-bold text-blue-600">GHS {Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <Link
              href="/store"
              className="inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-soft hover:shadow-md transition-all"
            >
              Continue Shopping
            </Link>
          </div>
        )}

        {/* Empty State */}
        {!order && !loading && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-soft">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-slate-600">Enter your order details above to track your order</p>
          </div>
        )}
      </div>
    </div>
  );
}
