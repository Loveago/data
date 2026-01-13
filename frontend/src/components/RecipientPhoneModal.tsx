"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import type { Product } from "@/lib/types";
import { getNetworkMeta, getNetworkPrefixes } from "@/lib/network";

function normalizeMsisdn(input: string) {
  const raw = input.trim().replace(/\s+/g, "");
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
    return digits;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}

function RecipientPhoneModalInner({
  product,
  onCancel,
  onConfirm,
}: {
  product: Product;
  onCancel: () => void;
  onConfirm: (recipientPhone: string) => void;
}) {
  const [value, setValue] = useState("");
  const [iconFailed, setIconFailed] = useState(false);

  const slug = product.category?.slug;
  const categoryName = product.category?.name;
  const normalized = normalizeMsisdn(value);
  const prefixes = getNetworkPrefixes(slug);
  const meta = getNetworkMeta({ slug, name: categoryName });
  const network = { name: meta.label, icon: meta.icon };

  const n = (network.name || "N").trim();
  const networkInitials =
    n.toLowerCase() === "airteltigo"
      ? "AT"
      : n.toLowerCase() === "telecel"
        ? "TC"
        : n.toLowerCase() === "mtn"
          ? "MTN"
          : (() => {
              const parts = n.split(/\s+/).filter(Boolean);
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return (parts[0][0] + parts[1][0]).toUpperCase();
            })();

  const s = String(slug || "").toLowerCase();
  const networkBadgeClass =
    s === "mtn"
      ? "bg-yellow-500 text-black"
      : s === "telecel"
        ? "bg-red-600 text-white"
        : s === "airteltigo"
          ? "bg-rose-600 text-white"
          : "bg-zinc-700 text-white";

  const prefixMatchesNetwork = !normalized || prefixes.length === 0 ? true : prefixes.some((p) => normalized.startsWith(p));

  const isValid = normalized.startsWith("0") && normalized.length === 10;

  const gb = /(\d+(?:\.\d+)?)\s*gb/i.exec(product.name)?.[0]?.toUpperCase();
  const packageLabel = `${gb || "BUNDLE"} - ${network.name} ${gb || ""}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />

      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Enter Recipient Phone Number</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Please enter the phone number that will receive the data bundle.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium">Phone Number</label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0240000000"
            className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-blue-600"
          />
          <div className="mt-2 text-xs text-zinc-500">Valid prefixes: {prefixes.length ? prefixes.join(", ") : "Any"}</div>

          {!prefixMatchesNetwork ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              The number prefix doesn’t match <span className="font-semibold">{network.name}</span>. You can still continue if you’re sure.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex gap-2">
              <div className="mt-[1px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>Please ensure the phone number is correct. Data will be sent to this number and cannot be reversed.</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-500">Network:</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-900 ring-1 ring-black/5 dark:bg-zinc-950 dark:text-white dark:ring-white/10">
                  {network.icon && !iconFailed ? (
                    <img
                      src={network.icon}
                      alt={network.name}
                      className="h-4 w-4 object-contain"
                      onError={() => setIconFailed(true)}
                    />
                  ) : (
                    <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${networkBadgeClass}`}>
                      {networkInitials}
                    </span>
                  )}
                  {network.name}
                </div>
              </div>
            </div>
            <div className="text-xs text-zinc-500">Package:</div>
            <div className="mt-1 font-semibold">{packageLabel}</div>
            <div className="mt-2 text-xs text-zinc-500">Price:</div>
            <div className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">GHS {Number(product.price).toFixed(2)}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onConfirm(normalized)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecipientPhoneModal({
  open,
  product,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  product: Product | null;
  onCancel: () => void;
  onConfirm: (recipientPhone: string) => void;
}) {
  const [mounted] = useState(() => typeof document !== "undefined");

  if (!mounted || !open || !product) return null;

  const resetKey = `${String(product.category?.slug || "")}-${open ? "open" : "closed"}`;

  return createPortal(
    <RecipientPhoneModalInner key={resetKey} product={product} onCancel={onCancel} onConfirm={onConfirm} />, 
    document.body
  );
}
