"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { CartItem, Product } from "@/lib/types";
import { clearStorefrontCart, loadStorefrontCart, saveStorefrontCart } from "@/lib/storage";

type StorefrontCartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number, recipientPhone?: string, priceOverride?: number) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  clear: () => void;
};

const StorefrontCartContext = createContext<StorefrontCartContextValue | null>(null);

export function StorefrontCartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    const loaded = loadStorefrontCart(slug);
    const makeId = (productId: string) => {
      const cryptoObj = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
      if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
      return `${productId}-${Date.now()}-${Math.random()}`;
    };

    setTimeout(() => {
      setItems(
        loaded.map((it) => ({
          ...it,
          id: typeof it.id === "string" && it.id ? it.id : makeId(it.productId),
        }))
      );
      setLoadedOnce(true);
    }, 0);
  }, [slug]);

  useEffect(() => {
    if (!loadedOnce) return;
    saveStorefrontCart(slug, items);
  }, [items, loadedOnce, slug]);

  const value = useMemo<StorefrontCartContextValue>(() => {
    const addItem: StorefrontCartContextValue["addItem"] = (product, quantity = 1, recipientPhone, priceOverride) => {
      setItems((prev) => {
        const next = [...prev];
        const keyPhone = recipientPhone?.trim() || undefined;
        const existing = next.find((x) => x.productId === product.id && (x.recipientPhone || undefined) === keyPhone);
        const priceNum = Number(priceOverride ?? product.price);
        if (existing) {
          existing.quantity += quantity;
          return next;
        }
        const cryptoObj = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
        const id = cryptoObj?.randomUUID ? cryptoObj.randomUUID() : `${product.id}-${Date.now()}-${Math.random()}`;
        next.push({
          id,
          productId: product.id,
          name: product.name,
          price: Number.isFinite(priceNum) ? priceNum : 0,
          quantity,
          imageUrl: product.imageUrls?.[0],
          categoryName: product.category?.name,
          categorySlug: product.category?.slug,
          recipientPhone: keyPhone,
        });
        return next;
      });
    };

    const removeItem: StorefrontCartContextValue["removeItem"] = (itemId) => {
      setItems((prev) => prev.filter((x) => x.id !== itemId));
    };

    const setQuantity: StorefrontCartContextValue["setQuantity"] = (itemId, quantity) => {
      const q = Math.max(1, Math.floor(quantity));
      setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, quantity: q } : x)));
    };

    const clear = () => {
      setItems([]);
      clearStorefrontCart(slug);
    };

    const count = items.reduce((acc, it) => acc + it.quantity, 0);
    const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    return { items, count, subtotal, addItem, removeItem, setQuantity, clear };
  }, [items, slug]);

  return <StorefrontCartContext.Provider value={value}>{children}</StorefrontCartContext.Provider>;
}

export function useStorefrontCart() {
  const ctx = useContext(StorefrontCartContext);
  if (!ctx) throw new Error("useStorefrontCart must be used within StorefrontCartProvider");
  return ctx;
}
