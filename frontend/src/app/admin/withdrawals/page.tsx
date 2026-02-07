"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

type Withdrawal = {
  id: string;
  userId: string;
  user: { id: string; email: string; name: string | null; phone: string | null };
  amount: string;
  fee: string;
  totalDeducted: string;
  momoNumber: string;
  momoNetwork: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get<{ items: Withdrawal[] }>(`/admin/withdrawals${suffix}`);
      setItems(res.data.items || []);
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to load withdrawals.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionBusy((prev) => ({ ...prev, [id]: true }));
    try {
      await api.patch(`/admin/withdrawals/${id}/${action}`, {
        adminNote: noteInputs[id] || undefined,
      });
      await load();
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || `Failed to ${action} withdrawal.`);
    } finally {
      setActionBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  const pendingCount = items.filter((w) => w.status === "PENDING").length;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Withdrawals</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Review and process user withdrawal requests.
        {pendingCount > 0 ? (
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {pendingCount} pending
          </span>
        ) : null}
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">No withdrawal requests.</div>
        ) : (
          <div className="space-y-4">
            {items.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">GHS {w.amount}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[w.status] || ""}`}>
                        {w.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Fee: GHS {w.fee} &middot; Total deducted: GHS {w.totalDeducted}
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    {new Date(w.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">User</div>
                    <div className="mt-0.5 text-sm">{w.user?.name || "-"}</div>
                    <div className="text-xs text-zinc-500">{w.user?.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">MoMo Number</div>
                    <div className="mt-0.5 text-sm font-mono font-semibold">{w.momoNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">Network</div>
                    <div className="mt-0.5 text-sm font-semibold">{w.momoNetwork}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">Phone</div>
                    <div className="mt-0.5 text-sm">{w.user?.phone || "-"}</div>
                  </div>
                </div>

                {w.adminNote ? (
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                    <span className="font-semibold">Admin note:</span> {w.adminNote}
                  </div>
                ) : null}

                {w.processedAt ? (
                  <div className="mt-2 text-xs text-zinc-500">
                    Processed: {new Date(w.processedAt).toLocaleString()}
                  </div>
                ) : null}

                {w.status === "PENDING" ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input
                      value={noteInputs[w.id] || ""}
                      onChange={(e) => setNoteInputs((prev) => ({ ...prev, [w.id]: e.target.value }))}
                      placeholder="Admin note (optional)"
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!!actionBusy[w.id]}
                        onClick={() => handleAction(w.id, "approve")}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionBusy[w.id] ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={!!actionBusy[w.id]}
                        onClick={() => handleAction(w.id, "reject")}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {actionBusy[w.id] ? "..." : "Reject"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
