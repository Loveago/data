"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function PaystackCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { clear } = useCart();

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

      let pending: any = null;
      try {
        const raw = window.sessionStorage.getItem("gigshub_paystack_pending");
        pending = raw ? JSON.parse(raw) : null;
      } catch {
        pending = null;
      }

      try {
        setMessage("Finalizing your order...");
        const res = await api.post("/payments/paystack/complete-public", {
          reference,
          customerName: pending?.customerName,
          customerEmail: pending?.customerEmail,
          customerPhone: pending?.customerPhone,
          customerAddress: pending?.customerAddress,
          items: pending?.items,
        });

        if (cancelled) return;
        window.sessionStorage.removeItem("gigshub_paystack_pending");
        clear();
        setStatus("success");
        setMessage("Payment confirmed. Redirecting...");
        const label = res.data?.orderCode || res.data?.id;
        router.push(`/dashboard?order=${encodeURIComponent(label)}`);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.response?.data?.error || "Payment verification failed.";
        setStatus("error");
        setMessage(msg);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [clear, router, search]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-lg font-semibold">
          {status === "loading" ? "Processing" : status === "success" ? "Success" : "Something went wrong"}
        </div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</div>

        {status === "error" ? (
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Back to checkout
          </button>
        ) : null}
      </div>
    </div>
  );
}
