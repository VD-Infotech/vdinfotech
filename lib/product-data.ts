import "server-only";

import { connectToDatabase } from "@/lib/db";
import { publicProductFilter } from "@/lib/product";
import { Product } from "@/models/product";

export type PublicProduct = {
  id: string; title: string; slug: string; summary: string; contentHtml: string;
  category: string; tags: string[]; technologies: string[]; liveDemoUrl: string;
  featured: boolean; displayOrder: number; seoTitle: string; seoDescription: string;
  publishedAt: Date; updatedAt: Date; author: { id: string; name: string };
  cover: { id: string; altText: string } | null;
  gallery: { id: string; altText: string }[];
};

type PopulatedProduct = {
  _id: { toString(): string }; title: string; slug: string; summary: string; contentHtml: string;
  category: string; tags: string[]; technologies: string[]; liveDemoUrl?: string;
  featured: boolean; displayOrder: number; seoTitle?: string; seoDescription?: string;
  publishedAt: Date; updatedAt: Date;
  author: { _id: { toString(): string }; name: string };
  coverMedia?: { _id: { toString(): string }; altText?: string } | null;
  galleryMedia?: { _id: { toString(): string }; altText?: string }[];
};

export function toPublicProduct(product: PopulatedProduct): PublicProduct {
  return {
    id: product._id.toString(), title: product.title, slug: product.slug, summary: product.summary,
    contentHtml: product.contentHtml, category: product.category, tags: product.tags || [],
    technologies: product.technologies || [], liveDemoUrl: product.liveDemoUrl || "",
    featured: product.featured, displayOrder: product.displayOrder || 0,
    seoTitle: product.seoTitle || "", seoDescription: product.seoDescription || "",
    publishedAt: product.publishedAt, updatedAt: product.updatedAt,
    author: { id: product.author._id.toString(), name: product.author.name },
    cover: product.coverMedia ? { id: product.coverMedia._id.toString(), altText: product.coverMedia.altText || "" } : null,
    gallery: (product.galleryMedia || []).map((image) => ({ id: image._id.toString(), altText: image.altText || "" })),
  };
}

function publicQuery(filter: Record<string, unknown>) {
  return Product.find({ ...publicProductFilter(), ...filter })
    .populate("author", "name").populate("coverMedia", "altText").populate("galleryMedia", "altText");
}

export async function findPublishedProducts(filter: Record<string, unknown>, options: { skip?: number; limit?: number } = {}) {
  await connectToDatabase();
  const products = await publicQuery(filter).sort({ publishedAt: -1 }).skip(options.skip || 0)
    .limit(options.limit || 0).lean<PopulatedProduct[]>().exec();
  return products.filter((product) => product.author).map(toPublicProduct);
}

export async function getPublicProductBySlug(slug: string) {
  await connectToDatabase();
  let normalizedSlug = slug.trim().toLowerCase();
  try { normalizedSlug = decodeURIComponent(normalizedSlug); } catch { return null; }
  const product = await Product.findOne({ slug: normalizedSlug, status: "published", deletedAt: null })
    .populate("author", "name").populate("coverMedia", "altText").populate("galleryMedia", "altText")
    .lean<PopulatedProduct>().exec();
  if (!product?.author || !product.publishedAt || product.publishedAt > new Date()) return null;
  return toPublicProduct(product);
}

export async function getHomepageProducts(limit = 3) {
  await connectToDatabase();
  const featured = await publicQuery({ featured: true }).sort({ displayOrder: 1, publishedAt: -1 })
    .limit(limit).lean<PopulatedProduct[]>().exec();
  const selected = featured.filter((product) => product.author);
  if (selected.length < limit) {
    const excluded = selected.map((product) => product._id);
    const latest = await publicQuery(excluded.length ? { _id: { $nin: excluded } } : {})
      .sort({ publishedAt: -1 }).limit(limit - selected.length).lean<PopulatedProduct[]>().exec();
    selected.push(...latest.filter((product) => product.author));
  }
  return selected.map(toPublicProduct);
}
