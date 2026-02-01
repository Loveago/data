"use client";

import { StorefrontCartProvider } from "@/context/StorefrontCartContext";

export default function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return <StorefrontCartProvider slug={params.slug}>{children}</StorefrontCartProvider>;
}
