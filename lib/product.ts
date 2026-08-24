import "server-only";

import { Product } from "@/models/product";

export const PRODUCTS_PER_PAGE = 9;

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "product";
}

export async function createUniqueProductSlug(title: string) {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (await Product.exists({ slug })) slug = `${base}-${suffix++}`;
  return slug;
}

export function publicProductFilter(now = new Date()) {
  return { status: "published", deletedAt: null, publishedAt: { $lte: now } };
}

export function productDisplayStatus(product: { status: string; publishedAt?: Date | null; deletedAt?: Date | null }) {
  if (product.deletedAt) return "Trashed";
  if (product.status === "draft") return "Draft";
  if (product.publishedAt && product.publishedAt > new Date()) return "Scheduled";
  return "Published";
}
