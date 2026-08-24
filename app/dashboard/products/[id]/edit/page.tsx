import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/product";
import { ProductEditor, type EditableProduct } from "../../product-editor";

export const metadata: Metadata = { title: "Edit Product | VD Infotech" };
export default async function EditProductPage({ params }: PageProps<"/dashboard/products/[id]/edit">) {
  const user = await requireUser(); const { id } = await params; if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const product = await Product.findOne({ _id: id, author: user.id, deletedAt: null }).populate("galleryMedia", "altText").lean().exec();
  if (!product) notFound();
  const gallery = (product.galleryMedia as unknown as { _id: Types.ObjectId; altText?: string }[] || []).map((image) => ({ id: image._id.toString(), url: `/media/${image._id.toString()}`, altText: image.altText || "" }));
  const editable: EditableProduct = {
    id: product._id.toString(), title: product.title, summary: product.summary, category: product.category,
    tags: product.tags || [], technologies: product.technologies || [], contentHtml: product.contentHtml,
    liveDemoUrl: product.liveDemoUrl || "", featured: Boolean(product.featured), displayOrder: product.displayOrder || 0,
    seoTitle: product.seoTitle || "", seoDescription: product.seoDescription || "", publishedAt: product.publishedAt?.toISOString() || "",
    status: product.status, coverMediaId: product.coverMedia?.toString() || "", gallery,
  };
  return <section className="dashboard-content dashboard-editor-page"><ProductEditor product={editable} /></section>;
}
