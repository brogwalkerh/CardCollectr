// Root layout: wraps every page. Server component (no "use client"), so it
// renders once on the server and ships almost no JS of its own.

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deck Collector",
  description: "Bulk-collect public Archidekt decklists into local SQLite",
};

const NAV = [
  { href: "/new", label: "New Job" },
  { href: "/jobs", label: "Jobs" },
  { href: "/browse", label: "Browse" },
  { href: "/export", label: "Export" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800 bg-zinc-900">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <span className="text-lg font-semibold tracking-tight text-amber-400">
              Deck Collector
            </span>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                // Link = client-side navigation (no full page reload).
                // key= is required by React when rendering a list.
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
