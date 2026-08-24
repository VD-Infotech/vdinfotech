import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/product";

export const metadata: Metadata = { title: "Product Preview | VD Infotech", robots: { index: false, follow: false } };
export default async function PreviewProductPage({ params }: PageProps<"/dashboard/products/[id]/preview">) {
  const user = await requireUser(); const { id } = await params; if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const product = await Product.findOne({ _id: id, author: user.id, deletedAt: null }).populate("galleryMedia", "altText").lean().exec();
  if (!product) notFound();
  const gallery = product.galleryMedia as unknown as { _id: Types.ObjectId; altText?: string }[];
  return <section className="dashboard-content preview-page"><div className="preview-banner"><span>Private preview</span><Link href={`/dashboard/products/${id}/edit`}>← Back to editor</Link></div><article className="product-detail-preview"><header><span className="blog-category">{product.category}</span><h1>{product.title}</h1><p>{product.summary}</p>{product.liveDemoUrl && <a className="button button-dark" href={product.liveDemoUrl} target="_blank" rel="noopener noreferrer">Live demo ↗</a>}</header>{gallery.length > 0 && <div className="preview-product-gallery">{gallery.map((image) => <Image key={image._id.toString()} src={`/media/${image._id.toString()}`} alt={image.altText || product.title} width={760} height={480} unoptimized />)}</div>}<div className="article-content" dangerouslySetInnerHTML={{ __html: product.contentHtml }} /></article></section>;
}
