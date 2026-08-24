import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { connectToDatabase } from "@/lib/db";
import { PRODUCTS_PER_PAGE, publicProductFilter } from "@/lib/product";
import { findPublishedProducts } from "@/lib/product-data";
import { Product } from "@/models/product";

export const metadata: Metadata = { title: "Products | VD Infotech", description: "Explore software products and digital experiences designed and engineered by VD Infotech.", alternates: { canonical: "/products" } };
export const dynamic = "force-dynamic";
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const category = typeof params.category === "string" ? params.category.trim().slice(0, 60) : "";
  const technology = typeof params.technology === "string" ? params.technology.trim().slice(0, 40) : "";
  const tag = typeof params.tag === "string" ? params.tag.trim().slice(0, 40) : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const filter: Record<string, unknown> = {};
  if (q) filter.$or = ["title", "summary", "contentText", "category", "tags", "technologies"].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } }));
  if (category) filter.category = category; if (technology) filter.technologies = technology; if (tag) filter.tags = tag;
  await connectToDatabase();
  const [products, total, categories, technologies, tags] = await Promise.all([
    findPublishedProducts(filter, { skip: (page - 1) * PRODUCTS_PER_PAGE, limit: PRODUCTS_PER_PAGE }),
    Product.countDocuments({ ...publicProductFilter(), ...filter }), Product.distinct("category", publicProductFilter()),
    Product.distinct("technologies", publicProductFilter()), Product.distinct("tags", publicProductFilter()),
  ]);
  const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const href = (updates: Record<string, string>) => `/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), ...(technology ? { technology } : {}), ...(tag ? { tag } : {}), ...updates })}`;
  return <main className="products-page"><section className="products-hero"><div className="shell"><p className="eyebrow light"><span /> VD Infotech products</p><h1>Digital products built to <em>perform.</em></h1><p>Explore the platforms, applications, and experiences we have brought from idea to real-world impact.</p></div></section><section className="products-listing shell">
    <form className="blog-search"><input type="search" name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" /><button type="submit">Search</button></form>
    <div className="blog-filter-row"><Link className={!category && !technology && !tag ? "is-active" : ""} href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"}>All</Link>{categories.slice(0, 8).map((item) => <Link className={category === item ? "is-active" : ""} href={href({ category: item, technology: "", tag: "", page: "1" })} key={item}>{item}</Link>)}</div>
    {(technology || tag) && <p className="active-filter">Showing {technology ? "technology" : "tag"}: <strong>{technology || `#${tag}`}</strong> <Link href={href({ technology: "", tag: "", page: "1" })}>Clear</Link></p>}
    {products.length ? <div className="product-card-grid">{products.map((product) => <article className="public-product-card" key={product.id}>{product.cover ? <Link className="product-card-image" href={`/products/${product.slug}`}><Image src={`/media/${product.cover.id}`} alt={product.cover.altText || product.title} width={800} height={520} unoptimized /></Link> : <Link className="product-card-image product-card-placeholder" href={`/products/${product.slug}`}><span>VD</span></Link>}<div className="product-card-copy"><span className="blog-category">{product.category}</span><h2><Link href={`/products/${product.slug}`}>{product.title}</Link></h2><p>{product.summary}</p><div className="technology-list">{product.technologies.slice(0, 4).map((item) => <Link href={`/products?technology=${encodeURIComponent(item)}`} key={item}>{item}</Link>)}</div><Link className="product-card-link" href={`/products/${product.slug}`}>View case study →</Link></div></article>)}</div> : <div className="blog-empty"><h2>No products found.</h2><p>Try another keyword or clear the active filters.</p><Link href="/products">View all products</Link></div>}
    {pages > 1 && <nav className="pagination blog-pagination" aria-label="Products pagination">{page > 1 && <Link href={href({ page: String(page - 1) })}>← Previous</Link>}<span>Page {Math.min(page, pages)} of {pages}</span>{page < pages && <Link href={href({ page: String(page + 1) })}>Next →</Link>}</nav>}
    <aside className="popular-tags"><span>Technologies</span>{technologies.slice(0, 10).map((item) => <Link href={`/products?technology=${encodeURIComponent(item)}`} key={item}>{item}</Link>)}{tags.slice(0, 8).map((item) => <Link href={`/products?tag=${encodeURIComponent(item)}`} key={item}>#{item}</Link>)}</aside>
  </section></main>;
}
