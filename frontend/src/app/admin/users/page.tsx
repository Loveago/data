"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "USER" | "ADMIN" | "AGENT";
  walletBalance?: string;
  createdAt: string;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"set" | "increment">("increment");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: AdminUser[] }>("/admin/users");
      setUsers(res.data.items || []);
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(id: string, role: AdminUser["role"]) {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      await load();
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to update role.");
    }
  }

  async function submitWallet() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${selected.id}/wallet-balance`, {
        mode: walletMode,
        amount: walletAmount,
        reason: walletReason,
      });
      setWalletOpen(false);
      setWalletAmount("");
      setWalletReason("");
      await load();
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to update wallet balance.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordReset() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${selected.id}/reset-password`, { newPassword });
      setPasswordOpen(false);
      setNewPassword("");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function forceLogout(u: AdminUser) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${u.id}/force-logout`);
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to force logout.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [u.email, u.name || "", u.phone || "", u.role].some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Manage users, roles, passwords, and wallet balances.</p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, name, phone, role..."
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 sm:max-w-md"
        />
        <button
          type="button"
          onClick={load}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-3">Email</th>
                  <th className="py-3">Name</th>
                  <th className="py-3">Phone</th>
                  <th className="py-3">Wallet</th>
                  <th className="py-3">Created</th>
                  <th className="py-3">Role</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-3 font-medium">{u.email}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">{u.name || "-"}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">{u.phone || "-"}</td>
                    <td className="py-3 font-semibold">{formatMoney(Number(u.walletBalance || 0))}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="py-3">
                      <select
                        value={u.role}
                        onChange={(e) => setRole(u.id, e.target.value as AdminUser["role"])}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="AGENT">AGENT</option>
                      </select>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSelected(u);
                            setWalletOpen(true);
                            setWalletMode("increment");
                            setWalletAmount("");
                            setWalletReason("");
                          }}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          Wallet
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSelected(u);
                            setPasswordOpen(true);
                            setNewPassword("");
                          }}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => forceLogout(u)}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          Force logout
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {walletOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setWalletOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
            <div className="text-lg font-semibold">Adjust wallet balance</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{selected.email}</div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <select
                value={walletMode}
                onChange={(e) => {
                  const v = e.target.value;
                  setWalletMode(v === "increment" || v === "set" ? v : "increment");
                }}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="increment">Increment</option>
                <option value="set">Set exact balance</option>
              </select>
              <input
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                placeholder={walletMode === "increment" ? "e.g. 10.00 or -5.00" : "e.g. 100.00"}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <input
              value={walletReason}
              onChange={(e) => setWalletReason(e.target.value)}
              placeholder="Reason (optional)"
              className="mt-3 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setWalletOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitWallet}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setPasswordOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
            <div className="text-lg font-semibold">Reset password</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{selected.email}</div>

            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="mt-5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPasswordOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitPasswordReset}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {busy ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
