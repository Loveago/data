"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function AgentUpgradeCallbackInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { updateSession } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Verifying agent upgrade...");

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
        setMessage("Finalizing your agent upgrade...");
        const res = await api.post("/payments/agent-upgrade/complete-public", { reference });
        if (cancelled) return;
        window.sessionStorage.removeItem("gigshub_agent_upgrade_pending");
        if (res.data?.user) {
          updateSession({ user: res.data.user });
        }
        setStatus("success");
        setMessage(res.data?.alreadyAgent ? "Agent status already active. Redirecting..." : "Upgrade confirmed. Redirecting...");
        router.push("/dashboard?agentUpgrade=success");
      } catch (e: unknown) {
        if (cancelled) return;
        const maybeError = e as { response?: { data?: { error?: string } } };
        const msg = maybeError?.response?.data?.error || "Upgrade verification failed.";
        setStatus("error");
        setMessage(msg);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, search, updateSession]);

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

export default function AgentUpgradeCallbackPage() {
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
      <AgentUpgradeCallbackInner />
    </Suspense>
  );
}
