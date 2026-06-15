"use client";

import { useState, useMemo } from "react";

type StorefrontProduct = {
  id: string;
  sellPrice?: string | null;
  product: {
    id: string;
    name: string;
    price: string;
    agentPrice?: string | null;
    category?: { name: string } | null;
  };
};

function formatMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS" }).format(n);
}

export function StorefrontSettings({
  isAgent,
  storefront,
  storefrontItems,
  storefrontPrices,
  setStorefrontPrices,
  storefrontTitle,
  setStorefrontTitle,
  storefrontSlug,
  setStorefrontSlug,
  storefrontEmoji,
  setStorefrontEmoji,
  storefrontWelcome,
  setStorefrontWelcome,
  storefrontWhatsapp,
  setStorefrontWhatsapp,
  storefrontAccent,
  setStorefrontAccent,
  storefrontLink,
  storefrontLoading,
  storefrontError,
  storefrontSuccess,
  storefrontInfoSaving,
  storefrontPricesSaving,
  saveStorefrontInfo,
  saveStorefrontPrices,
  filteredStorefrontItems,
  storefrontSearch,
  setStorefrontSearch,
}: {
  isAgent: boolean;
  storefront: { slug?: string | null } | null;
  storefrontItems: StorefrontProduct[];
  storefrontPrices: Record<string, string>;
  setStorefrontPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  storefrontTitle: string;
  setStorefrontTitle: (v: string) => void;
  storefrontSlug: string;
  setStorefrontSlug: (v: string) => void;
  storefrontEmoji: string;
  setStorefrontEmoji: (v: string) => void;
  storefrontWelcome: string;
  setStorefrontWelcome: (v: string) => void;
  storefrontWhatsapp: string;
  setStorefrontWhatsapp: (v: string) => void;
  storefrontAccent: string;
  setStorefrontAccent: (v: string) => void;
  storefrontLink: string;
  storefrontLoading: boolean;
  storefrontError: string | null;
  storefrontSuccess: string | null;
  storefrontInfoSaving: boolean;
  storefrontPricesSaving: boolean;
  saveStorefrontInfo: () => Promise<void>;
  saveStorefrontPrices: () => Promise<void>;
  filteredStorefrontItems: StorefrontProduct[];
  storefrontSearch: string;
  setStorefrontSearch: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!storefrontLink) return;
    void navigator.clipboard?.writeText(storefrontLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Settings Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white">Agent Storefront</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Customize your public storefront and set bundle prices.</div>
          </div>
          {isAgent ? (
            <button
              type="button"
              disabled={storefrontInfoSaving}
              onClick={() => saveStorefrontInfo()}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 disabled:opacity-60"
            >
              {storefrontInfoSaving ? "Saving..." : "Save settings"}
            </button>
          ) : null}
        </div>

        {!isAgent ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Upgrade to Agent to unlock your personal storefront and pricing tools.
          </div>
        ) : storefrontLoading ? (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading storefront...</div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Store name</label>
              <input
                value={storefrontTitle}
                onChange={(e) => setStorefrontTitle(e.target.value)}
                placeholder="Emma's Data Store"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Store slug</label>
              <input
                value={storefrontSlug}
                onChange={(e) => setStorefrontSlug(e.target.value)}
                placeholder="emma-store"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Highlight emoji</label>
              <input
                value={storefrontEmoji}
                onChange={(e) => setStorefrontEmoji(e.target.value)}
                placeholder="🛰️"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Welcome message</label>
              <input
                value={storefrontWelcome}
                onChange={(e) => setStorefrontWelcome(e.target.value)}
                placeholder="Welcome to Emma's data store."
                className="mt-1 h-11 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">WhatsApp link</label>
              <input
                value={storefrontWhatsapp}
                onChange={(e) => setStorefrontWhatsapp(e.target.value)}
                placeholder="https://wa.me/233XXXXXXXXX"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">Paste your WhatsApp channel or direct message link. It will appear as a chat bubble on your storefront.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Accent color</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  value={storefrontAccent || "#1d4ed8"}
                  onChange={(e) => setStorefrontAccent(e.target.value)}
                  className="h-11 w-14 rounded-xl border border-slate-200/80 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  value={storefrontAccent}
                  onChange={(e) => setStorefrontAccent(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Storefront link</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={storefrontLink || ""}
                  readOnly
                  className="h-11 flex-1 rounded-xl border border-slate-200/80 bg-slate-50 px-3 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white">Bundle pricing</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Set your selling price (must be above base price).</div>
          </div>
          {isAgent ? (
            <button
              type="button"
              disabled={storefrontPricesSaving}
              onClick={() => saveStorefrontPrices()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {storefrontPricesSaving ? "Saving..." : "Save prices"}
            </button>
          ) : null}
        </div>

        {storefrontLoading ? (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading bundles...</div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={storefrontSearch}
                onChange={(e) => setStorefrontSearch(e.target.value)}
                placeholder="Search bundles"
                className="h-11 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-emerald-500"
              />
              <div className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{filteredStorefrontItems.length} bundles</div>
            </div>

            {/* Desktop Table */}
            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 dark:border-slate-700">
                    <th className="py-3 pr-3">Bundle</th>
                    <th className="py-3 pr-3">Network</th>
                    <th className="py-3 pr-3">Agent price</th>
                    <th className="py-3 pr-3">Your price</th>
                    <th className="py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStorefrontItems.map((item) => {
                    const base = Number(item.product.agentPrice ?? item.product.price);
                    const priceValue = storefrontPrices[item.product.id] ?? item.sellPrice ?? "";
                    const sell = Number(priceValue);
                    const profit = Number.isFinite(sell) && Number.isFinite(base) ? sell - base : null;
                    const invalid = Number.isFinite(sell) && Number.isFinite(base) ? sell < base : false;
                    return (
                      <tr key={item.product.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-3 pr-3 font-medium">{item.product.name}</td>
                        <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">{item.product.category?.name || "-"}</td>
                        <td className="py-3 pr-3">{formatMoney(String(base))}</td>
                        <td className="py-3 pr-3">
                          <input
                            value={priceValue}
                            onChange={(e) =>
                              setStorefrontPrices((prev) => ({
                                ...prev,
                                [item.product.id]: e.target.value,
                              }))
                            }
                            placeholder="Set price"
                            className={`h-9 w-28 rounded-xl border px-3 text-sm outline-none transition ${
                              invalid
                                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"
                                : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            }`}
                          />
                        </td>
                        <td className="py-3 text-right">
                          {profit == null || Number.isNaN(profit) ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className={`text-sm font-semibold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
                              {formatMoney(String(profit))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="mt-4 flex flex-col gap-3 sm:hidden">
              {filteredStorefrontItems.map((item) => {
                const base = Number(item.product.agentPrice ?? item.product.price);
                const priceValue = storefrontPrices[item.product.id] ?? item.sellPrice ?? "";
                const sell = Number(priceValue);
                const profit = Number.isFinite(sell) && Number.isFinite(base) ? sell - base : null;
                const invalid = Number.isFinite(sell) && Number.isFinite(base) ? sell < base : false;
                return (
                  <div key={item.product.id} className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.product.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.product.category?.name || "-"}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-500">Agent</div>
                        <div className="text-sm font-semibold">{formatMoney(String(base))}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">Your price</label>
                        <input
                          value={priceValue}
                          onChange={(e) =>
                            setStorefrontPrices((prev) => ({
                              ...prev,
                              [item.product.id]: e.target.value,
                            }))
                          }
                          placeholder="Set price"
                          className={`mt-1 block h-10 w-full min-w-[120px] rounded-xl border px-3 text-sm outline-none transition ${
                            invalid
                              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"
                              : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          }`}
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-slate-500">Profit</div>
                        <div className="mt-1 text-sm font-bold">
                          {profit == null || Number.isNaN(profit) ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className={profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}>
                              {formatMoney(String(profit))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {storefrontError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {storefrontError}
        </div>
      ) : null}
      {storefrontSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {storefrontSuccess}
        </div>
      ) : null}
    </div>
  );
}
