"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { extractMediaIds, htmlToPlainText, normalizeTags, sanitizePostHtml } from "@/lib/blog";
import { connectToDatabase } from "@/lib/db";
import { removeImage } from "@/lib/media-storage";
import { createUniqueProductSlug } from "@/lib/product";
import { Media } from "@/models/media";
import { Product } from "@/models/product";

const galleryItemSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/, "Invalid gallery image."),
  altText: z.string().trim().max(180),
});

const productSchema = z.object({
  title: z.string().trim().min(3, "Title must contain at least 3 characters.").max(160),
  summary: z.string().trim().min(20, "Summary must contain at least 20 characters.").max(320),
  category: z.string().trim().min(2, "Enter a category.").max(60),
  tags: z.string().max(400),
  technologies: z.string().max(600),
  contentHtml: z.string().min(1, "Write a product description."),
  liveDemoUrl: z.union([z.literal(""), z.string().url("Enter a valid URL.").startsWith("https://", "Live demo must use HTTPS.").max(500)]),
  seoTitle: z.string().trim().max(70, "SEO title must contain at most 70 characters."),
  seoDescription: z.string().trim().max(170, "SEO description must contain at most 170 characters."),
  gallery: z.array(galleryItemSchema).max(12, "A product can have at most 12 gallery images."),
  coverMediaId: z.string().trim(),
  productId: z.string().trim(),
  featured: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(9999),
  intent: z.enum(["draft", "publish", "schedule"]),
  publishedAt: z.string().trim(),
  timezoneOffset: z.coerce.number().min(-840).max(840),
});

export type ProductFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> };

function parseScheduledDate(value: string, offsetMinutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute) + offsetMinutes * 60_000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function refreshProducts(slug?: string) {
  ["/", "/products", "/dashboard", "/dashboard/products", "/dashboard/products/trash", "/sitemap.xml"]
    .forEach((path) => revalidatePath(path));
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function saveProductAction(_state: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const user = await requireUser();
  let gallery: unknown;
  try { gallery = JSON.parse(String(formData.get("gallery") || "[]")); }
  catch { return { message: "The gallery data is invalid. Refresh and try again." }; }
  const raw = {
    ...Object.fromEntries(["title", "summary", "category", "tags", "technologies", "contentHtml", "liveDemoUrl", "seoTitle", "seoDescription", "coverMediaId", "productId", "intent", "publishedAt", "timezoneOffset"].map((key) => [key, String(formData.get(key) ?? "")])),
    featured: formData.get("featured") === "on", gallery,
  };
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]>, message: "Please correct the highlighted fields." };

  const contentHtml = sanitizePostHtml(parsed.data.contentHtml);
  const contentText = htmlToPlainText(contentHtml);
  if (contentText.length < 50) return { errors: { contentHtml: ["Description must contain at least 50 characters."] } };
  const galleryIds = parsed.data.gallery.map((item) => item.id);
  if (new Set(galleryIds).size !== galleryIds.length) return { errors: { gallery: ["The gallery contains a duplicate image."] } };
  if (parsed.data.coverMediaId && !galleryIds.includes(parsed.data.coverMediaId)) return { errors: { gallery: ["The cover must be selected from the gallery."] } };

  let status: "draft" | "published" = "draft";
  let publishedAt: Date | null = null;
  if (parsed.data.intent === "publish") { status = "published"; publishedAt = new Date(); }
  if (parsed.data.intent === "schedule") {
    publishedAt = parseScheduledDate(parsed.data.publishedAt, parsed.data.timezoneOffset);
    if (!publishedAt || publishedAt <= new Date()) return { errors: { publishedAt: ["Choose a valid future publishing date and time."] } };
    status = "published";
  }

  const inlineMediaIds = extractMediaIds(contentHtml);
  const requestedMediaIds = [...new Set([...inlineMediaIds, ...galleryIds])];
  if (requestedMediaIds.some((id) => !Types.ObjectId.isValid(id))) return { message: "One or more selected files are invalid." };
  const isEditing = Boolean(parsed.data.productId);
  if (isEditing && !Types.ObjectId.isValid(parsed.data.productId)) return { message: "Product not found." };

  await connectToDatabase();
  const product = isEditing
    ? await Product.findOne({ _id: parsed.data.productId, author: user.id, deletedAt: null }).exec()
    : null;
  if (isEditing && !product) return { message: "Product not found or you do not have access." };
  const ownedMedia = requestedMediaIds.length
    ? await Media.find({ _id: { $in: requestedMediaIds }, owner: user.id }).select("_id kind post product").lean().exec()
    : [];
  if (ownedMedia.length !== requestedMediaIds.length || ownedMedia.some((media) => media.post || (media.product && media.product.toString() !== parsed.data.productId))) {
    return { message: "One or more selected files are unavailable or attached elsewhere." };
  }
  const gallerySet = new Set(galleryIds);
  if (ownedMedia.some((media) => gallerySet.has(media._id.toString()) && media.kind !== "image")) return { errors: { gallery: ["Gallery items must be images."] } };

  const previousMediaIds = product?.mediaIds.map((id: Types.ObjectId) => id.toString()) ?? [];
  const slug = product?.slug ?? await createUniqueProductSlug(parsed.data.title);
  const values = {
    title: parsed.data.title, summary: parsed.data.summary, category: parsed.data.category,
    tags: normalizeTags(parsed.data.tags), technologies: normalizeTags(parsed.data.technologies),
    contentHtml, contentText, liveDemoUrl: parsed.data.liveDemoUrl,
    galleryMedia: galleryIds, coverMedia: parsed.data.coverMediaId || null, mediaIds: requestedMediaIds,
    featured: parsed.data.featured, displayOrder: parsed.data.displayOrder,
    seoTitle: parsed.data.seoTitle, seoDescription: parsed.data.seoDescription, status, publishedAt,
  };
  const saved = product || new Product({ author: user.id, slug });
  saved.set(values);
  await saved.save();

  if (parsed.data.gallery.length) {
    await Promise.all(parsed.data.gallery.map((item) => Media.updateOne(
      { _id: item.id, owner: user.id }, { $set: { product: saved._id, altText: item.altText } },
    )));
  }
  const nonGalleryIds = requestedMediaIds.filter((id) => !gallerySet.has(id));
  if (nonGalleryIds.length) await Media.updateMany({ _id: { $in: nonGalleryIds }, owner: user.id }, { $set: { product: saved._id } });
  const removedIds = previousMediaIds.filter((id: string) => !requestedMediaIds.includes(id));
  if (removedIds.length) {
    const removed = await Media.find({ _id: { $in: removedIds }, owner: user.id, product: saved._id }).select("storedName").lean().exec();
    await Promise.all(removed.map((item) => removeImage(item.storedName)));
    await Media.deleteMany({ _id: { $in: removedIds }, owner: user.id, product: saved._id });
  }

  refreshProducts(slug);
  if (!isEditing) redirect(`/dashboard/products/${saved._id.toString()}/edit`);
  return { success: true, message: parsed.data.intent === "draft" ? "Draft saved." : parsed.data.intent === "schedule" ? "Product scheduled." : "Product published." };
}

async function findOwnedProduct(formData: FormData, deleted: boolean) {
  const user = await requireUser();
  const productId = String(formData.get("productId") ?? "");
  if (!Types.ObjectId.isValid(productId)) return null;
  await connectToDatabase();
  return Product.findOne({ _id: productId, author: user.id, deletedAt: deleted ? { $ne: null } : null }).exec();
}

export async function moveProductToTrashAction(formData: FormData) {
  const product = await findOwnedProduct(formData, false); if (!product) return;
  product.deletedAt = new Date(); await product.save(); refreshProducts(product.slug);
}
export async function restoreProductAction(formData: FormData) {
  const product = await findOwnedProduct(formData, true); if (!product) return;
  product.deletedAt = null; await product.save(); refreshProducts(product.slug);
}
export async function unpublishProductAction(formData: FormData) {
  const product = await findOwnedProduct(formData, false); if (!product) return;
  product.status = "draft"; product.publishedAt = null; await product.save(); refreshProducts(product.slug);
}
export async function permanentlyDeleteProductAction(formData: FormData) {
  const product = await findOwnedProduct(formData, true); if (!product) return;
  const media = await Media.find({ owner: product.author, product: product._id }).select("storedName").lean().exec();
  await Promise.all(media.map((item) => removeImage(item.storedName)));
  await Media.deleteMany({ owner: product.author, product: product._id });
  await product.deleteOne(); refreshProducts(product.slug);
}
