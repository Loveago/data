"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { api } from "@/lib/api";

interface OrderData {
  id: string;
  orderCode: string;
  total: string;
  subtotal: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt: string;
  items: Array<{
    id: string;
    product: {
      name: string;
    };
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
}

function PaystackCallbackInner() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params?.slug || "");
  const search = useSearchParams();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Verifying payment...");
  const [order, setOrder] = useState<OrderData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const reference = search.get("reference") || search.get("trxref") || "";
      if (!reference) {
        setStatus("error");
        setMessage("Missing payment reference.");
        return;
      }

      try {
        setMessage("Finalizing your order...");
        const res = await api.post<{ order: OrderData }>(
          "/payments/paystack/complete-public",
          {
            reference,
            storefrontSlug: slug,
          }
        );

        if (cancelled) return;
        setOrder(res.data.order);
        setStatus("success");
        setMessage("Payment confirmed!");
      } catch (e: unknown) {
        if (cancelled) return;
        const maybeError = e as { response?: { data?: { error?: string } } };
        const msg = maybeError?.response?.data?.error || "Payment verification failed.";
        setStatus("error");
        setMessage(msg);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, search, slug]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft max-w-md w-full">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500 mb-4"></div>
          <div className="text-lg font-semibold text-slate-900">Processing</div>
          <div className="mt-2 text-sm text-slate-600">{message}</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-soft max-w-md w-full">
          <div className="text-2xl mb-4">❌</div>
          <div className="text-lg font-semibold text-red-900">Payment Failed</div>
          <div className="mt-2 text-sm text-red-800">{message}</div>
          <Link
            href={`/storefront/${slug}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700"
          >
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Success Header */}
        <div className="mb-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
          <p className="text-slate-600">Your data bundle has been activated</p>
        </div>

        {/* Receipt */}
        {order && (
          <div className="space-y-6">
            {/* Order Details Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
              <div className="mb-6 pb-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{order.orderCode}</h2>
                <p className="text-sm text-slate-600">{formatDate(order.createdAt)}</p>
              </div>

              {/* Customer Info */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Customer Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium text-slate-900">{order.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Phone:</span>
                    <span className="font-medium text-slate-900">{order.customerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email:</span>
                    <span className="font-medium text-slate-900">{order.customerEmail}</span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Items Purchased</h3>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        {item.product.name} x {item.quantity}
                      </span>
                      <span className="font-medium text-slate-900">GHS {Number(item.lineTotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">GHS {Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Total Paid</span>
                  <span className="text-lg font-bold text-green-600">GHS {Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="mt-1">✓</span>
                  <span>Your data bundle has been activated on your phone number</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">✓</span>
                  <span>You can check your order status anytime using your order ID</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">✓</span>
                  <span>If you have any issues, contact our support team</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-col sm:flex-row">
              <Link
                href={`/track-order`}
                className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
              >
                Track Order
              </Link>
              <Link
                href={`/storefront/${slug}`}
                className="flex-1 inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold hover:bg-slate-50 transition"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft max-w-md w-full">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500 mb-4"></div>
            <div className="text-lg font-semibold">Processing</div>
            <div className="mt-2 text-sm text-slate-600">Loading...</div>
          </div>
        </div>
      }
    >
      <PaystackCallbackInner />
    </Suspense>
  );
}
