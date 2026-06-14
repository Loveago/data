import Link from "next/link";

import { ProductsGrid } from "@/components/ProductsGrid";

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.35] dark:opacity-[0.18]" />
        <div className="absolute inset-0 hero-wash" />

        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-indigo-700 ring-1 ring-indigo-100">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="currentColor"/>
                  </svg>
                </span>
                Fast Delivery
              </div>

              <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-900 dark:text-white sm:text-6xl">
                Instant Data
                <br />
                <span className="text-gradient-purple">Services 4U</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Buy data bundles, AFA registration, and more in minutes with smooth checkout and 24/7 support.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/store"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 text-sm font-semibold text-white shadow-soft hover:opacity-95"
                >
                  Shop Now
                </Link>
                <Link
                  href="https://chat.whatsapp.com/DU930JTfukeH4aDoDq2et4"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:hover:bg-slate-800"
                >
                  Join Community
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-[32px] bg-white/70 p-3 shadow-card ring-1 ring-slate-200 backdrop-blur">
                <img
                  src="/hero-illustration.svg"
                  alt="LOFAQ hero"
                  className="h-auto w-full rounded-[28px]"
                />
              </div>

              <div className="pointer-events-none absolute -left-6 top-16 hidden h-14 w-14 items-center justify-center rounded-full bg-white text-sm font-extrabold text-indigo-700 shadow-card ring-1 ring-slate-200 md:flex animate-floaty">
                at
              </div>
              <div className="pointer-events-none absolute left-10 bottom-10 hidden h-14 w-14 items-center justify-center rounded-full bg-yellow-300 text-sm font-extrabold text-slate-900 shadow-card ring-1 ring-yellow-200 md:flex animate-floaty2">
                MTN
              </div>
              <div className="pointer-events-none absolute -right-6 top-20 hidden h-14 w-14 items-center justify-center rounded-full bg-red-500 text-2xl font-black text-white shadow-card ring-1 ring-red-300 md:flex animate-floaty2">
                t
              </div>
              <div className="pointer-events-none absolute right-8 bottom-6 hidden h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-sm font-extrabold text-white shadow-card ring-1 ring-emerald-300 md:flex animate-floaty">
                GH
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <ProductsGrid title="Featured products" query={{ limit: 6 }} />
      </div>
    </div>
  );
}
