import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">© 2026 LOFAQ™</p>
        <div className="flex items-center gap-4 text-sm">
          <Link href="#" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Privacy
          </Link>
          <Link href="#" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Terms
          </Link>
          <Link href="#" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
