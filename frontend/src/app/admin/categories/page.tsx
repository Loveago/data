"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type Category = { id: string; name: string; slug: string };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: Category[] }>("/categories");
      setCategories(res.data.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load categories.");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCategory() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/categories", { name, slug });
      setName("");
      setSlug("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to create category.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditSlug(c.slug);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSlug("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/categories/${editingId}`, { name: editName, slug: editSlug });
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to update category.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to delete category.");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Manage product categories.</p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Create category</h2>
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
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => createCategory()}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Create category"}
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">All categories</h2>

        {loading ? (
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No categories yet.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-3">Name</th>
                  <th className="py-3">Slug</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-3 font-medium">
                      {editingId === c.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                        />
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {editingId === c.id ? (
                        <input
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                        />
                      ) : (
                        c.slug
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {editingId === c.id ? (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveEdit()}
                            className="text-sm font-medium text-zinc-900 hover:text-zinc-700 disabled:opacity-60 dark:text-white dark:hover:text-zinc-200"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => cancelEdit()}
                            className="text-sm font-medium text-zinc-600 hover:text-zinc-800 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="text-sm font-medium text-zinc-900 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCategory(c.id)}
                            className="text-sm font-medium text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      )}
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
