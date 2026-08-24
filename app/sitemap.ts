import type { MetadataRoute } from "next";
import { connectToDatabase } from "@/lib/db";
import { publicPostFilter } from "@/lib/blog";
import { siteUrl } from "@/lib/blog-data";
import { Post } from "@/models/post";
import { publicProductFilter } from "@/lib/product";
import { Product } from "@/models/product";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/products`, changeFrequency: "weekly", priority: 0.9 },
  ];

  try {
    await connectToDatabase();
    const [posts, products] = await Promise.all([
      Post.find(publicPostFilter()).select("slug updatedAt").lean().exec(),
      Product.find(publicProductFilter()).select("slug updatedAt galleryMedia").lean().exec(),
    ]);
    return [...staticRoutes,
      ...posts.map((post) => ({ url: `${base}/blog/${post.slug}`, lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
      ...products.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "monthly" as const, priority: 0.8, images: (product.galleryMedia || []).map((id: { toString(): string }) => `${base}/media/${id.toString()}`) })),
    ];
  } catch {
    return staticRoutes;
  }
}
