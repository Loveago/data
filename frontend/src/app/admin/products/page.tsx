"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

type Category = { id: string; name: string; slug: string };

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

function slugify(value: string) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [bundleAmount, setBundleAmount] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrls, setImageUrls] = useState("");

  const parsedImages = useMemo(() => {
    return imageUrls
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [imageUrls]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId) || null;
  }, [categories, categoryId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        api.get<{ items: Category[] }>("/categories"),
        api.get<ProductsResponse>("/products", { params: { limit: 50 } }),
      ]);

      setCategories(cats.data.items || []);
      setProducts(prods.data.items || []);
      if (!categoryId && (cats.data.items || []).length > 0) {
        setCategoryId(cats.data.items[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load products.");
      setCategories([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setSlug(p.slug);
    setDescription(p.description);
    setPrice(String(p.price));
    setStock(String(p.stock));
    setCategoryId(p.category?.id || "");
    setImageUrls(Array.isArray(p.imageUrls) ? p.imageUrls.join(", ") : "");
  }

  function cancelEdit() {
    setEditingId(null);
    setBundleAmount("");
    setName("");
    setSlug("");
    setDescription("");
    setPrice("");
    setStock("0");
    setImageUrls("");
  }

  function applyBundleTemplate() {
    if (!selectedCategory) {
      setError("Select a network/category first.");
      return;
    }
    if (!bundleAmount.trim()) {
      setError("Enter a data amount like 1GB, 2GB, 5GB...");
      return;
    }

    const amount = bundleAmount.trim().toUpperCase();
    const baseName = `${selectedCategory.name} ${amount} Data Bundle`;
    const nextSlug = slugify(`${selectedCategory.slug}-${amount}`);

    setName(baseName);
    setSlug(nextSlug);
    setDescription(`${selectedCategory.name} ${amount} data bundle.`);
  }

  async function saveProduct() {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, {
          name,
          slug,
          description,
          price,
          stock: Number(stock),
          categoryId,
          imageUrls: parsedImages,
        });
        cancelEdit();
      } else {
        await api.post("/products", {
          name,
          slug,
          description,
          price,
          stock: Number(stock),
          categoryId,
          imageUrls: parsedImages,
        });

        setName("");
        setSlug("");
        setDescription("");
        setPrice("");
        setStock("0");
        setImageUrls("");
      }

      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || (editingId ? "Failed to update product." : "Failed to create product."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to delete product.");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Create, edit, and delete products.</p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">{editingId ? "Edit product" : "Create product"}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <input
            value={bundleAmount}
            onChange={(e) => setBundleAmount(e.target.value)}
            placeholder="Data amount (e.g. 1GB, 2GB, 5GB)"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => applyBundleTemplate()}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
          >
            Fill name + slug
          </button>
          <div className="text-xs text-zinc-500 sm:pt-2">
            Select network below, then fill this to match the storefront format.
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Slug (unique)"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (e.g. 12.50)"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Stock"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            placeholder="Image URLs (comma separated)"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 sm:col-span-2"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="min-h-28 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 sm:col-span-2"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => saveProduct()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Create product"}
          </button>

          {editingId ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => cancelEdit()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">All products</h2>

        {loading ? (
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        ) : products.length === 0 ? (
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No products yet.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-3">Name</th>
                  <th className="py-3">Category</th>
                  <th className="py-3">Price</th>
                  <th className="py-3">Stock</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">{p.category?.name}</td>
                    <td className="py-3">{p.price}</td>
                    <td className="py-3">{p.stock}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="text-sm font-medium text-zinc-900 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProduct(p.id)}
                          className="text-sm font-medium text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
                        >
                          Delete
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
    </div>
  );
}
