"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";

type NotificationLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  createdAt: string;
};

const EMOJIS = ["📢", "🎉", "✅", "⚠️", "❌", "💡", "🔥", "🚀", "💰", "📦", "❤️", "👍", "🙏", "⭐", "🕒", "📌"];

function levelBadge(level: NotificationLevel) {
  if (level === "SUCCESS") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (level === "WARNING") return "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
  if (level === "ERROR") return "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200";
  return "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200";
}

function exec(command: string, value?: string) {
  if (typeof document === "undefined") return;
  try {
    if (value === undefined) document.execCommand(command);
    else document.execCommand(command, false, value);
  } catch {
    // noop
  }
}

function insertTextAtCursor(text: string) {
  try {
    exec("insertText", text);
  } catch {
    exec("insertHTML", text);
  }
}

function applyFontSize(px: number) {
  if (typeof window === "undefined") return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    exec("insertHTML", `<span style=\"font-size:${px}px\">&#8203;</span>`);
    return;
  }

  const wrapper = document.createElement("span");
  wrapper.style.fontSize = `${px}px`;

  try {
    range.surroundContents(wrapper);
    sel.removeAllRanges();
  } catch {
    exec("insertHTML", `<span style=\"font-size:${px}px\">${range.toString()}</span>`);
  }
}

export default function AdminNotificationsPage() {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<NotificationLevel>("INFO");
  const [bodyHtml, setBodyHtml] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const previewTitle = useMemo(() => {
    return title.trim() ? title.trim() : "Preview title";
  }, [title]);

  async function loadRecent() {
    setRecentLoading(true);
    try {
      const res = await api.get<{ items: NotificationItem[] }>("/admin/notifications", { params: { limit: 50 } });
      setRecent(res.data.items || []);
    } catch {
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  }

  useEffect(() => {
    void loadRecent();
  }, []);

  async function send() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    const t = title.trim();
    const body = bodyHtml.trim();

    try {
      if (!t) {
        setError("Title is required.");
        return;
      }
      if (!body) {
        setError("Message body is required.");
        return;
      }

      await api.post("/admin/notifications", { title: t, body, level });

      setSuccess("Notification sent.");
      setTitle("");
      setBodyHtml("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      await loadRecent();
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Failed to send notification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Send announcements to users. Supports emojis and basic formatting.</p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? "Sending..." : "Send"}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Payment system maintenance tonight"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-blue-500"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Level</label>
              <select
                value={level}
                onChange={(e) => {
                  const v = String(e.target.value || "").toUpperCase();
                  if (v === "SUCCESS" || v === "WARNING" || v === "ERROR" || v === "INFO") setLevel(v);
                }}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-blue-500"
              >
                <option value="INFO">Info</option>
                <option value="SUCCESS">Success</option>
                <option value="WARNING">Warning</option>
                <option value="ERROR">Error</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Message</label>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
                <button type="button" onClick={() => exec("bold")} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  Bold
                </button>
                <button type="button" onClick={() => exec("italic")} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  Italic
                </button>
                <button type="button" onClick={() => exec("underline")} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  Underline
                </button>
                <button
                  type="button"
                  onClick={() => exec("insertUnorderedList")}
                  className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  Bullets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt("Enter link URL");
                    if (!url) return;
                    exec("createLink", url);
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => exec("removeFormat")}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Clear
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyFontSize(12)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    Small
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFontSize(14)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFontSize(18)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    Large
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertTextAtCursor(e)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-lg hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    title="Insert emoji"
                  >
                    {e}
                  </button>
                ))}
              </div>

              <div className="relative">
                {!bodyHtml.trim() ? (
                  <div className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-400 dark:text-zinc-500">
                    Type your notification message...
                  </div>
                ) : null}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const html = (e.currentTarget as HTMLDivElement).innerHTML;
                    setBodyHtml(html);
                  }}
                  className="min-h-[160px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-blue-500"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                {success}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Preview</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">This is how it will look in the user bell dropdown.</div>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${levelBadge(level)}`}>{level}</span>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{previewTitle}</div>
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: bodyHtml || "" }} />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Recent notifications</div>
              <button
                type="button"
                onClick={() => void loadRecent()}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Refresh
              </button>
            </div>

            {recentLoading ? (
              <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
            ) : recent.length === 0 ? (
              <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No notifications yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {recent.slice(0, 10).map((n) => (
                  <div key={n.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{n.title}</div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: n.body }} />
                        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${levelBadge(n.level)}`}>{n.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
