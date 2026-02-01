import { StorefrontCartProvider } from "@/context/StorefrontCartContext";

type LayoutParams = Promise<{ slug: string }> | { slug: string };

type StorefrontLayoutProps = {
  children: React.ReactNode;
  params: LayoutParams;
};

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  const resolvedParams = await Promise.resolve(params);
  return <StorefrontCartProvider slug={resolvedParams.slug}>{children}</StorefrontCartProvider>;
}
