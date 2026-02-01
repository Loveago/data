"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { useStorefrontCart } from "@/context/StorefrontCartContext";

function PaystackCallbackInner() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params?.slug || "");
  const search = useSearchParams();
  const { clear } = useStorefrontCart();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Verifying payment...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const reference = search.get("reference") || search.get("trxref") || "";
      if (!reference) {
        setStatus("error");
        setMessage("Missing payment reference.");
        return;
      }

      let pending:
        | {
            customerName?: string;
            customerEmail?: string;
            customerPhone?: string;
            customerAddress?: string;
            storefrontSlug?: string;
          }
        | null = null;
      try {
        const raw = window.sessionStorage.getItem(`gigshub_storefront_paystack_pending:${slug}`);
        pending = raw ? JSON.parse(raw) : null;
      } catch {
        pending = null;
      }

      try {
        setMessage("Finalizing your order...");
        await api.post("/payments/paystack/complete-public", {
          reference,
          customerName: pending?.customerName,
          customerEmail: pending?.customerEmail,
          customerPhone: pending?.customerPhone,
          customerAddress: pending?.customerAddress,
          storefrontSlug: pending?.storefrontSlug || slug,
        });

        if (cancelled) return;
        window.sessionStorage.removeItem(`gigshub_storefront_paystack_pending:${slug}`);
        clear();
        setStatus("success");
        setMessage("Payment confirmed. Redirecting...");
        router.push(`/storefront/${slug}`);
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
  }, [clear, router, search, slug]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-soft">
        <div className="text-lg font-semibold">
          {status === "loading" ? "Processing" : status === "success" ? "Success" : "Something went wrong"}
        </div>
        <div className="mt-2 text-sm text-zinc-600">{message}</div>

        {status === "error" ? (
          <button
            type="button"
            onClick={() => router.push(`/storefront/${slug}/checkout`)}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Back to checkout
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function PaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-soft">
            <div className="text-lg font-semibold">Processing</div>
            <div className="mt-2 text-sm text-zinc-600">Loading...</div>
          </div>
        </div>
      }
    >
      <PaystackCallbackInner />
    </Suspense>
  );
}
