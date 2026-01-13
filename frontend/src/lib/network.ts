export type NetworkMeta = {
  label: string;
  initials: string;
  icon: string | null;
  badgeClass: string;
};

export function getNetworkMeta(input?: { slug?: string; name?: string }): NetworkMeta {
  const slug = (input?.slug || "").toLowerCase();
  const name = input?.name || "";

  if (slug === "mtn") return { label: "MTN", initials: "MTN", icon: "/networks/mtn.svg", badgeClass: "bg-yellow-500 text-black" };
  if (slug === "telecel") return { label: "Telecel", initials: "TC", icon: "/networks/telecel-logo.svg", badgeClass: "bg-red-600 text-white" };
  if (slug === "airteltigo") return { label: "AirtelTigo", initials: "AT", icon: "/networks/airteltigo.svg", badgeClass: "bg-rose-600 text-white" };

  const fallbackLabel = name || "Network";
  const parts = fallbackLabel.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : fallbackLabel.slice(0, 2).toUpperCase();
  return { label: fallbackLabel, initials, icon: null, badgeClass: "bg-zinc-700 text-white" };
}

export function getNetworkPrefixes(slug?: string) {
  const s = (slug || "").toLowerCase();
  if (s === "mtn") return ["024", "054", "055", "059"];
  if (s === "airteltigo") return ["026", "056", "027", "057"];
  if (s === "telecel") return ["020", "050"];
  return [] as string[];
}
