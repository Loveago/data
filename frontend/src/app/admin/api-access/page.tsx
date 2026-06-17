"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type ApiRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null; role: string };
  apiKey: { id: string; key: string; isActive: boolean; lastUsedAt: string | null; createdAt: string } | null;
};

export default function AdminApiAccessPage() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ requests: ApiRequest[] }>("/admin/api-access");
      setRequests(res.data.requests || []);
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to load API access requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setBusy(id + action);
    setError(null);
    try {
      await api.patch(`/admin/api-access/${id}`, { action });
      await load();
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || `Failed to ${action} request.`);
    } finally {
      setBusy(null);
    }
  }

  function copyKey(key: string) {
    void navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const statusBadge = (status: string) => {
    if (status === "APPROVED") return "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (status === "REJECTED") return "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300";
    return "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">API Access Requests</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Review and manage user API access requests. Approved users receive an API key.
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="text-sm text-zinc-500">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-zinc-500">No API access requests yet.</div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.user.email}</span>
                      {r.user.name && <span className="text-sm text-zinc-500">({r.user.name})</span>}
                      <span className="text-xs rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-700">{r.user.role}</span>
                      <span className={statusBadge(r.status)}>{r.status}</span>
                    </div>
                    {r.reason && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">&ldquo;{r.reason}&rdquo;</p>
                    )}
                    <div className="text-xs text-zinc-400">
                      Requested {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.status !== "APPROVED" && (
                      <button
                        type="button"
                        disabled={busy === r.id + "approve"}
                        onClick={() => handleAction(r.id, "approve")}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busy === r.id + "approve" ? "..." : "Approve"}
                      </button>
                    )}
                    {r.status !== "REJECTED" && (
                      <button
                        type="button"
                        disabled={busy === r.id + "reject"}
                        onClick={() => handleAction(r.id, "reject")}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/40 dark:bg-transparent dark:text-red-300"
                      >
                        {busy === r.id + "reject" ? "..." : "Reject"}
                      </button>
                    )}
                  </div>
                </div>

                {r.apiKey && (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                    <div className="text-xs font-semibold text-zinc-500 mb-1.5">API Key</div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-mono text-zinc-800 break-all dark:bg-zinc-800 dark:text-zinc-200">
                        {r.apiKey.key}
                      </code>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyKey(r.apiKey!.key)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          {copiedKey === r.apiKey.key ? "Copied!" : "Copy"}
                        </button>
                        <span className={`text-xs font-semibold ${r.apiKey.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {r.apiKey.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    {r.apiKey.lastUsedAt && (
                      <div className="mt-1 text-xs text-zinc-400">Last used: {new Date(r.apiKey.lastUsedAt).toLocaleString()}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
