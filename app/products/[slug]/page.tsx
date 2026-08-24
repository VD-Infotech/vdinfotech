import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { findPublishedProducts, getPublicProductBySlug } from "@/lib/product-data";
import { siteUrl } from "@/lib/blog-data";
import { ShareButtons } from "@/app/blog/share-buttons";
import { ProductGallery } from "./product-gallery";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params; const product = await getPublicProductBySlug(slug);
  if (!product) return { title: "Product Not Found | VD Infotech" };
  const title = product.seoTitle || product.title; const description = product.seoDescription || product.summary;
  const url = `${siteUrl()}/products/${product.slug}`;
  const images = product.cover ? [{ url: `${siteUrl()}/media/${product.cover.id}`, alt: product.cover.altText || product.title }] : [];
  return { title: `${title} | VD Infotech`, description, alternates: { canonical: url }, openGraph: { type: "website", title, description, url, siteName: "VD Infotech", images }, twitter: { card: "summary_large_image", title, description, images: images.map((image) => image.url) } };
}

export default async function ProductDetailPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params; const product = await getPublicProductBySlug(slug); if (!product) notFound();
  const related = await findPublishedProducts({ _id: { $ne: product.id }, $or: [{ category: product.category }, { tags: { $in: product.tags } }, { technologies: { $in: product.technologies } }] }, { limit: 3 });
  const productUrl = `${siteUrl()}/products/${product.slug}`;
  const screenshots = product.gallery.map((image) => `${siteUrl()}/media/${image.id}`);
  const jsonLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: product.title, description: product.seoDescription || product.summary, applicationCategory: product.category, operatingSystem: "Web", url: productUrl, datePublished: product.publishedAt.toISOString(), dateModified: product.updatedAt.toISOString(), creator: { "@type": "Person", name: product.author.name }, keywords: [...product.technologies, ...product.tags].join(", "), ...(product.cover ? { image: `${siteUrl()}/media/${product.cover.id}` } : {}), ...(screenshots.length ? { screenshot: screenshots } : {}), ...(product.liveDemoUrl ? { installUrl: product.liveDemoUrl } : {}) };
  return <main className="product-detail-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><article className="public-product-detail"><header className="product-detail-header shell"><div><Link className="blog-category" href={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link><h1>{product.title}</h1><p>{product.summary}</p><div className="product-detail-actions">{product.liveDemoUrl && <a className="button button-mint" href={product.liveDemoUrl} target="_blank" rel="noopener noreferrer">View live demo ↗</a>}<ShareButtons title={product.title} /></div></div><aside><span>Built with</span><div className="technology-list">{product.technologies.map((item) => <Link href={`/products?technology=${encodeURIComponent(item)}`} key={item}>{item}</Link>)}</div></aside></header><div className="shell"><ProductGallery images={product.gallery} coverId={product.cover?.id} title={product.title} /></div><div className="product-story shell"><div className="article-content" dangerouslySetInnerHTML={{ __html: product.contentHtml }} /><aside><span>Project details</span><dl><dt>Category</dt><dd>{product.category}</dd><dt>Published</dt><dd>{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(product.publishedAt)}</dd></dl><div className="article-tags">{product.tags.map((tag) => <Link href={`/products?tag=${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div></aside></div></article>
    {related.length > 0 && <section className="related-products shell"><div className="section-heading"><p className="eyebrow"><span /> More products</p><h2>Explore related <em>work.</em></h2></div><div className="related-product-grid">{related.map((item) => <article key={item.id}>{item.cover && <Link href={`/products/${item.slug}`}><Image src={`/media/${item.cover.id}`} alt={item.cover.altText || item.title} width={600} height={380} unoptimized /></Link>}<span>{item.category}</span><h3><Link href={`/products/${item.slug}`}>{item.title}</Link></h3><p>{item.summary}</p><Link href={`/products/${item.slug}`}>View product →</Link></article>)}</div></section>}
  </main>;
}
