"use client";

import { Fragment, useEffect, useState } from "react";

import { api } from "@/lib/api";

type AdminOrder = {
  id: string;
  orderCode?: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED";
  total: string;
  createdAt: string;
  paymentStatus?: string;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  user: { id: string; email: string };
  items: { id: string; quantity: number; recipientPhone?: string | null; product: { name: string } }[];
};

function formatOrderLabel(orderCode?: string | null, id?: string) {
  if (orderCode) return orderCode;
  return id ? `#${id}` : "#";
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatusFilter] = useState<"" | AdminOrder["status"]>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const suffix = params.toString() ? `?${params.toString()}` : "";

      const res = await api.get<{ items: AdminOrder[] }>(`/admin/orders${suffix}`);
      setOrders(res.data.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: AdminOrder["status"]) {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to update status.");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">View and manage all orders.</p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order code, user email, payment ref..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 sm:max-w-md"
          />
          <select
            value={status}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">No orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-3">Order</th>
                  <th className="py-3">User</th>
                  <th className="py-3">Created</th>
                  <th className="py-3">Total</th>
                  <th className="py-3">Payment</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <Fragment key={o.id}>
                    <tr key={o.id} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-3 font-medium">{formatOrderLabel(o.orderCode, o.id)}</td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400">{o.user?.email}</td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="py-3 font-semibold">{o.total}</td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400">
                        {(o.paymentStatus || "").toUpperCase() || "-"}
                        {o.paymentReference ? <div className="text-xs text-zinc-500">{o.paymentReference}</div> : null}
                      </td>
                      <td className="py-3">
                        <select
                          value={o.status}
                          onChange={(e) => setStatus(o.id, e.target.value as AdminOrder["status"])}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [o.id]: !prev[o.id] }))}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          {expanded[o.id] ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expanded[o.id] ? (
                      <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-900/30">
                        <td colSpan={7} className="py-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold text-zinc-500">Items</div>
                              <div className="mt-2 space-y-2">
                                {o.items.map((it) => (
                                  <div key={it.id} className="flex items-start justify-between gap-4 rounded-xl bg-white p-3 text-sm dark:bg-zinc-950">
                                    <div className="min-w-0">
                                      <div className="font-semibold">{it.product?.name}</div>
                                      {it.recipientPhone ? (
                                        <div className="mt-1 text-xs text-zinc-500">Recipient: {it.recipientPhone}</div>
                                      ) : null}
                                    </div>
                                    <div className="shrink-0 text-zinc-700 dark:text-zinc-300">x{it.quantity}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-zinc-500">Identifiers</div>
                              <div className="mt-2 rounded-xl bg-white p-3 text-sm dark:bg-zinc-950">
                                <div className="text-xs text-zinc-500">Order ID</div>
                                <div className="font-mono text-xs">{o.id}</div>
                                {o.orderCode ? (
                                  <>
                                    <div className="mt-3 text-xs text-zinc-500">Order code</div>
                                    <div className="font-mono text-xs">{o.orderCode}</div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
