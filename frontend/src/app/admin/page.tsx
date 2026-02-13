"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type Stats = {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: string;
};

type FulfillmentControl = {
  forcedProvider: "encart" | "datahubnet" | null;
  activeProvider: "encart" | "datahubnet";
  nowUtc: string;
  dayWindowUtc: {
    start: string;
    end: string;
  };
};

function formatMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentControl | null>(null);
  const [providerInput, setProviderInput] = useState<"auto" | "encart" | "datahubnet">("auto");
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [statsRes, providerRes] = await Promise.all([
          api.get<Stats>("/admin/stats"),
          api.get<FulfillmentControl>("/admin/fulfillment-provider"),
        ]);
        if (!cancelled) {
          setStats(statsRes.data);
          setFulfillment(providerRes.data);
          setProviderInput(providerRes.data.forcedProvider ?? "auto");
        }
      } catch {
        if (!cancelled) {
          setStats(null);
          setFulfillment(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveFulfillmentProvider() {
    setProviderSaving(true);
    setProviderMessage(null);
    try {
      const res = await api.patch<FulfillmentControl>("/admin/fulfillment-provider", {
        provider: providerInput,
      });
      setFulfillment(res.data);
      setProviderInput(res.data.forcedProvider ?? "auto");
      setProviderMessage("Fulfillment provider setting updated.");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setProviderMessage(maybeError?.response?.data?.error || "Failed to update fulfillment provider.");
    } finally {
      setProviderSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Overview of store activity.</p>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading...
        </div>
      ) : !stats ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          Failed to load admin stats.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total users</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalUsers}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total orders</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalOrders}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total revenue</p>
              <p className="mt-2 text-3xl font-semibold">{formatMoney(stats.totalRevenue)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Fulfillment Provider Control</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Force a provider temporarily, or leave auto to use the GMT time window.
            </p>

            <div className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                Active provider: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fulfillment?.activeProvider || "-"}</span>
              </div>
              <div>
                Forced provider: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fulfillment?.forcedProvider || "auto"}</span>
              </div>
              <div>
                Day window (UTC): {fulfillment?.dayWindowUtc.start || "08:30"} - {fulfillment?.dayWindowUtc.end || "18:00"}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={providerInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "encart" || v === "datahubnet") setProviderInput(v);
                  else setProviderInput("auto");
                }}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="auto">Auto (time-based)</option>
                <option value="encart">Force Encart</option>
                <option value="datahubnet">Force Datahubnet</option>
              </select>
              <button
                type="button"
                onClick={saveFulfillmentProvider}
                disabled={providerSaving}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {providerSaving ? "Saving..." : "Save"}
              </button>
            </div>

            {providerMessage ? (
              <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{providerMessage}</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
