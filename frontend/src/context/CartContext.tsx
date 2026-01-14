"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { CartItem, Product } from "@/lib/types";
import { loadCart, saveCart } from "@/lib/storage";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number, recipientPhone?: string) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    const loaded = loadCart();
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
  }, []);

  useEffect(() => {
    if (!loadedOnce) return;
    saveCart(items);
  }, [items, loadedOnce]);

  const value = useMemo<CartContextValue>(() => {
    const addItem: CartContextValue["addItem"] = (product, quantity = 1, recipientPhone) => {
      setItems((prev) => {
        const next = [...prev];
        const keyPhone = recipientPhone?.trim() || undefined;
        const existing = next.find((x) => x.productId === product.id && (x.recipientPhone || undefined) === keyPhone);
        const priceNum = Number(product.price);
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

    const removeItem: CartContextValue["removeItem"] = (itemId) => {
      setItems((prev) => prev.filter((x) => x.id !== itemId));
    };

    const setQuantity: CartContextValue["setQuantity"] = (itemId, quantity) => {
      const q = Math.max(1, Math.floor(quantity));
      setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, quantity: q } : x)));
    };

    const clear = () => setItems([]);

    const count = items.reduce((acc, it) => acc + it.quantity, 0);
    const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    return { items, count, subtotal, addItem, removeItem, setQuantity, clear };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
