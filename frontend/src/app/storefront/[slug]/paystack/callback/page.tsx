"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
    product: { name: string };
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
}

/* Small confetti particles using pure CSS */
function Confetti() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2.5 + Math.random() * 2}s`,
    color: ["#22c55e", "#3b82f6", "#eab308", "#f43f5e", "#8b5cf6", "#06b6d4"][i % 6],
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 animate-confetti rounded-sm opacity-90"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-white transition-all active:scale-95"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function PaystackCallbackInner() {
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
          { reference, storefrontSlug: slug }
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
    return () => { cancelled = true; };
  }, [search, slug]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  /* ─── Loading state ─── */
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl max-w-md w-full">
          <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <div className="text-lg font-bold text-slate-900">Processing Payment</div>
          <div className="mt-2 text-sm text-slate-500">{message}</div>
        </div>
      </div>
    );
  }

  /* ─── Error state ─── */
  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-2xl max-w-md w-full">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-700">Payment Failed</h2>
          <p className="mt-2 text-sm text-red-600">{message}</p>
          <Link
            href={`/storefront/${slug}`}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-red-600 px-8 text-sm font-bold text-white hover:bg-red-700 transition-all hover:-translate-y-0.5 shadow-lg"
          >
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Success state ─── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-100 py-8 px-4 relative">
      <Confetti />

      <div className="mx-auto max-w-lg relative z-10">
        {/* Animated Check */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-200 animate-bounce-once">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                className="animate-check-draw"
                style={{ strokeDasharray: 30, strokeDashoffset: 0 }}
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1 animate-fade-in-up">Payment Successful!</h1>
          <p className="text-sm text-slate-500 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>Your data bundle is being processed</p>
        </div>

        {/* Order ID Copy Card */}
        {order && (
          <>
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-lg animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="text-center mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Your Order ID</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-2xl font-black text-emerald-600 font-mono tracking-wider">{order.orderCode}</span>
                  <CopyButton text={order.orderCode} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Save this — you&apos;ll need it to track your order</p>
              </div>

              <div className="border-t border-slate-100 pt-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="font-medium text-slate-800">{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-medium text-slate-800">{order.customerPhone}</span>
                </div>
              </div>
            </div>

            {/* Items Card */}
            <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Summary</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="#10b981"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.product.name}</p>
                        <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">GHS {Number(item.lineTotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Total Paid</span>
                <span className="text-xl font-black text-emerald-600">GHS {Number(order.total).toFixed(2)}</span>
              </div>
            </div>

            {/* What's Next */}
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <h3 className="text-sm font-bold text-blue-800 mb-2">What&apos;s Next?</h3>
              <ul className="space-y-1.5 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Your data bundle will be delivered to the recipient phone shortly
                </li>
                <li className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Use your Order ID above to check status anytime
                </li>
                <li className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Need help? Contact support with your Order ID
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
              <Link
                href={`/storefront/${slug}`}
                className="w-full h-12 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Continue Shopping
              </Link>
              <Link
                href="/track-order"
                className="w-full h-12 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mr-2">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Track Order
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl max-w-md w-full">
            <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <div className="text-lg font-bold text-slate-900">Processing Payment</div>
            <div className="mt-2 text-sm text-slate-500">Please wait...</div>
          </div>
        </div>
      }
    >
      <PaystackCallbackInner />
    </Suspense>
  );
}
