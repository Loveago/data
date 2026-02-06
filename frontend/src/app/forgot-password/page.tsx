"use client";

import { useState } from "react";
import Link from "next/link";

import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSuccess(res.data?.message || "If that email exists, a reset link has been sent.");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      setError(maybeError?.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.35] dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 hero-wash" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-600/30 via-cyan-500/25 to-emerald-400/20 blur-3xl animate-floaty" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-500/25 via-blue-500/20 to-cyan-400/15 blur-3xl animate-floaty2" />

      <div className="relative w-full max-w-md">
        <div className="animate-fade-up">
          <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-7 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Forgot password</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <div className="mt-7 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
                />
              </div>

              {error ? (
                <div className="animate-fade-up rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="animate-fade-up rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {success}
                </div>
              ) : null}

              <button
                type="button"
                disabled={submitting}
                onClick={() => submit()}
                className="group inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_18px_40px_rgba(37,99,235,0.28)] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <span className="inline-flex items-center gap-2">
                  {submitting ? "Sending..." : "Send reset link"}
                  {submitting ? <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" /> : null}
                </span>
              </button>

              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Remember your password?{" "}
                <Link href="/login" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
