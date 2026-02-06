export type Role = "USER" | "ADMIN" | "AGENT";

export type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  walletBalance?: string;
  referralCode?: string | null;
  referredById?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  agentPrice?: string | null;
  stock: number;
  imageUrls: string[];
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  categoryName?: string;
  categorySlug?: string;
  recipientPhone?: string;
};

export type AgentStorefront = {
  id: string;
  slug: string;
  title: string;
  welcomeMessage?: string | null;
  heroEmoji?: string | null;
  accentColor?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StorefrontProduct = {
  product: Product;
  sellPrice: string | null;
};

export type OrderItemInput = {
  productId: string;
  quantity: number;
  recipientPhone?: string;
};
