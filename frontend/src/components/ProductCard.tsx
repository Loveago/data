"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { RecipientPhoneModal } from "@/components/RecipientPhoneModal";

function formatGhs(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `GHS ${value}`;
  return `GHS ${n.toFixed(2)}`;
}

function extractDataAmountGb(name: string) {
  const m = /(\d+(?:\.\d+)?)\s*gb/i.exec(name);
  if (!m) return null;
  return `${m[1]}GB`;
}

function networkMeta(slug?: string) {
  const s = (slug || "").toLowerCase();
  if (s === "mtn") {
    return {
      label: "MTN",
      icon: "/networks/mtn.svg",
      pill: "bg-white text-black",
      dot: "bg-yellow-400",
      border: "border-yellow-200 dark:border-yellow-900/40",
      badge: "bg-yellow-100 text-yellow-900 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-100 dark:ring-yellow-900/40",
      saveText: "text-yellow-700 dark:text-yellow-300",
      priceText: "text-yellow-600 dark:text-yellow-300",
      cta: "bg-yellow-400 text-black hover:bg-yellow-300",
      glow:
        "radial-gradient(500px 220px at 30% 10%, rgba(245, 158, 11, 0.18), transparent 60%), radial-gradient(500px 220px at 80% 20%, rgba(234, 179, 8, 0.16), transparent 60%)",
    };
  }
  if (s === "telecel") {
    return {
      label: "Telecel",
      icon: "/networks/telecel-logo.svg",
      pill: "bg-white text-black",
      dot: "bg-red-500",
      border: "border-red-200 dark:border-red-900/40",
      badge: "bg-red-100 text-red-900 ring-red-200 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-900/40",
      saveText: "text-red-600 dark:text-red-300",
      priceText: "text-red-600 dark:text-red-300",
      cta: "bg-red-500 text-white hover:bg-red-400",
      glow:
        "radial-gradient(500px 220px at 30% 10%, rgba(239, 68, 68, 0.18), transparent 60%), radial-gradient(500px 220px at 80% 20%, rgba(244, 63, 94, 0.14), transparent 60%)",
    };
  }
  if (s === "airteltigo") {
    return {
      label: "AT",
      icon: "/networks/airteltigo.svg",
      pill: "bg-white text-black",
      dot: "bg-blue-600",
      border: "border-blue-200 dark:border-blue-900/40",
      badge: "bg-blue-100 text-blue-900 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900/40",
      saveText: "text-blue-600 dark:text-blue-300",
      priceText: "text-blue-700 dark:text-blue-300",
      cta: "bg-blue-600 text-white hover:bg-blue-500",
      glow:
        "radial-gradient(500px 220px at 30% 10%, rgba(59, 130, 246, 0.18), transparent 60%), radial-gradient(500px 220px at 80% 20%, rgba(14, 165, 233, 0.14), transparent 60%)",
    };
  }
  if (s === "at-bigtime") {
    return {
      label: "AT",
      icon: "/networks/airteltigo.svg",
      pill: "bg-white text-black",
      dot: "bg-sky-600",
      border: "border-sky-200 dark:border-sky-900/40",
      badge: "bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-900/40",
      saveText: "text-sky-700 dark:text-sky-300",
      priceText: "text-sky-700 dark:text-sky-300",
      cta: "bg-sky-600 text-white hover:bg-sky-500",
      glow:
        "radial-gradient(500px 220px at 30% 10%, rgba(2, 132, 199, 0.18), transparent 60%), radial-gradient(500px 220px at 80% 20%, rgba(59, 130, 246, 0.14), transparent 60%)",
    };
  }
  return {
    label: "NET",
    icon: null as string | null,
    pill: "bg-zinc-200 text-zinc-900",
    dot: "bg-zinc-300",
    border: "border-zinc-200 dark:border-zinc-800",
    badge: "bg-zinc-100 text-zinc-900 ring-zinc-200",
    saveText: "text-blue-600",
    priceText: "text-yellow-600",
    cta: "bg-yellow-400 text-black hover:bg-yellow-300",
    glow:
      "radial-gradient(500px 220px at 30% 10%, rgba(245, 158, 11, 0.18), transparent 60%), radial-gradient(500px 220px at 80% 20%, rgba(234, 179, 8, 0.16), transparent 60%)",
  };
}

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [phoneOpen, setPhoneOpen] = useState(false);

  const amount = extractDataAmountGb(product.name) || "";
  const net = networkMeta(product.category?.slug);

  const priceNum = Number(product.price);
  const hasPrice = Number.isFinite(priceNum);
  const oldPrice = hasPrice ? (amount === "100GB" ? 390 : priceNum * 1.18) : null;
  const saveAmount = hasPrice && oldPrice ? oldPrice - priceNum : null;

  return (
    <div className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-soft transition hover:-translate-y-[2px] hover:shadow-lg dark:bg-zinc-950 ${net.border}`}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundImage: net.glow }} />

      <div className="relative">
        <div className="absolute left-2 top-2 z-10">
          <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ring-1 ${net.badge}`}>
            {amount || "DATA"}
          </span>
        </div>
        <div className="absolute right-2 top-2 z-10">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${net.pill} shadow-sm ring-1 ring-black/5`}>
            {net.icon ? (
              <img src={net.icon} alt={net.label} className="h-5 w-5 object-contain" />
            ) : (
              <span className="text-[10px] font-bold">{net.label}</span>
            )}
          </span>
        </div>

        <Link href={`/product/${product.slug || product.id}`} className="block">
          <div className="rounded-2xl border border-zinc-100 bg-white p-3 pt-10 dark:border-zinc-900 dark:bg-zinc-950">
            <div className={`text-xs font-medium ${net.saveText}`}>Save</div>
            <div className={`mt-1 text-lg font-extrabold tracking-tight ${net.priceText}`}>{formatGhs(product.price)}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {oldPrice != null ? (
                <span className="line-through">{formatGhs(String(oldPrice.toFixed(2)))}</span>
              ) : null}
              {saveAmount != null ? (
                <span className="text-zinc-400 dark:text-zinc-500">({formatGhs(String(saveAmount.toFixed(2)))} off)</span>
              ) : null}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{product.category?.name || ""}</div>
          </div>
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setPhoneOpen(true)}
        className={`relative mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold shadow-sm ${net.cta}`}
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black/10 dark:bg-white/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 7H20L19 14H7L6 7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M7 14L6 4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 20C9.55228 20 10 19.5523 10 19C10 18.4477 9.55228 18 9 18C8.44772 18 8 18.4477 8 19C8 19.5523 8.44772 20 9 20Z" fill="currentColor" />
            <path d="M17 20C17.5523 20 18 19.5523 18 19C18 18.4477 17.5523 18 17 18C16.4477 18 16 18.4477 16 19C16 19.5523 16.4477 20 17 20Z" fill="currentColor" />
          </svg>
        </span>
        Add to Purchase
      </button>

      <RecipientPhoneModal
        open={phoneOpen}
        product={product}
        onCancel={() => setPhoneOpen(false)}
        onConfirm={(recipientPhone) => {
          addItem(product, 1, recipientPhone);
          setPhoneOpen(false);
          router.push("/cart");
        }}
      />
    </div>
  );
}
