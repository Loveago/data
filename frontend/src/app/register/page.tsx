"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await register({ email, password, name: name || undefined, phone: phone || undefined, referralCode: referralCode.trim() || undefined });
      setSuccess(true);
      await new Promise((r) => setTimeout(r, 650));
      router.push("/dashboard");
    } catch (e: unknown) {
      const maybeError = e as { response?: { data?: { error?: string } } };
      const msg = maybeError?.response?.data?.error || "Registration failed.";
      setError(msg);
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

      <div className="relative w-full max-w-5xl">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/40">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-100 dark:bg-black/40 dark:text-emerald-200 dark:ring-emerald-900/40">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="currentColor" />
                </svg>
              </span>
              Create an account in seconds
            </div>

            <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-900 dark:text-white">
              Join the
              <br />
              <span className="text-gradient-blue">LOFAQ DATA HUB</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-zinc-300">
              Get a wallet, track orders, and enjoy fast checkout for your data bundles.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-slate-700 dark:text-zinc-200">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-blue-700 ring-1 ring-zinc-200 shadow-soft dark:bg-zinc-950/60 dark:text-blue-200 dark:ring-zinc-800">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M12 3l8 4v6c0 5-3.5 9-8 10C7.5 22 4 18 4 13V7l8-4z" stroke="currentColor" strokeWidth="2" />
                    <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Secure account with tokens
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-emerald-700 ring-1 ring-zinc-200 shadow-soft dark:bg-zinc-950/60 dark:text-emerald-200 dark:ring-zinc-800">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M4 7a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7z" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                Wallet + faster checkout
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-cyan-700 ring-1 ring-zinc-200 shadow-soft dark:bg-zinc-950/60 dark:text-cyan-200 dark:ring-zinc-800">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </span>
                Order tracking anytime
              </div>
            </div>
          </div>

          <div className="animate-fade-up">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-7 shadow-soft backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Create account</h1>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">It&apos;s quick and easy. You&apos;ll be ready to order in minutes.</p>
                  </div>
                  <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-soft">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                      <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="mt-7 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Phone</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0551234567"
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Referral Code <span className="text-zinc-400 dark:text-zinc-500">(optional)</span></label>
                    <input
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="e.g. LFQ-A1B2C3D4"
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                    />
                  </div>

                  {error ? (
                    <div className="animate-fade-up rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                      {error}
                    </div>
                  ) : null}

                  {success ? (
                    <div className="animate-fade-up rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                      Account created successfully.
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submit()}
                    className="group inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_18px_40px_rgba(16,185,129,0.28)] disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <span className="inline-flex items-center gap-2">
                      {success ? "Success" : submitting ? "Creating account" : "Create account"}
                      {submitting && !success ? <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" /> : null}
                    </span>
                  </button>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      Login
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
