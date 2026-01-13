"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";

function WalletPaystackCallbackInner() {
  const router = useRouter();
  const search = useSearchParams();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying deposit...");

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
        const raw = window.sessionStorage.getItem("gigshub_wallet_deposit_pending");
        pending = raw ? JSON.parse(raw) : null;
      } catch {
        pending = null;
      }

      try {
        setMessage("Updating your wallet...");
        await api.post("/wallet/deposit/paystack/complete-public", { reference, amount: pending?.amount });
        if (cancelled) return;
        window.sessionStorage.removeItem("gigshub_wallet_deposit_pending");
        setStatus("success");
        setMessage("Deposit confirmed. Redirecting...");
        router.push("/dashboard");
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.response?.data?.error || "Deposit verification failed.";
        setStatus("error");
        setMessage(msg);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, search]);

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
            onClick={() => router.push("/dashboard")}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Back to dashboard
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function WalletPaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-lg font-semibold">Processing</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
          </div>
        </div>
      }
    >
      <WalletPaystackCallbackInner />
    </Suspense>
  );
}
