import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { productDisplayStatus } from "@/lib/product";
import { Product } from "@/models/product";
import { ProductRowActions } from "./product-row-actions";

export const metadata: Metadata = { title: "Manage Products | VD Infotech" };
const PAGE_SIZE = 10;
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(); const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const filter: Record<string, unknown> = { author: user.id, deletedAt: null };
  if (query) filter.$or = ["title", "summary", "category", "tags", "technologies"].map((field) => ({ [field]: { $regex: escapeRegex(query), $options: "i" } }));
  if (status === "draft") filter.status = "draft";
  if (status === "published") Object.assign(filter, { status: "published", publishedAt: { $lte: new Date() } });
  if (status === "scheduled") Object.assign(filter, { status: "published", publishedAt: { $gt: new Date() } });
  await connectToDatabase();
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean().exec(),
    Product.countDocuments(filter),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (nextPage: number) => `/dashboard/products?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status !== "all" ? { status } : {}), page: String(nextPage) })}`;
  return <section className="dashboard-content dashboard-post-manager">
    <div className="manager-heading"><div><p className="eyebrow"><span /> Portfolio library</p><h1>Your products</h1><p>Create, preview, publish, and curate your software portfolio.</p></div><div className="manager-actions"><Link href="/dashboard/products/trash">Product trash</Link><Link className="dashboard-primary-action" href="/dashboard/products/new">Create new product</Link></div></div>
    <form className="post-filters"><input type="search" name="q" defaultValue={query} placeholder="Search products" /><select name="status" defaultValue={status}><option value="all">All statuses</option><option value="draft">Drafts</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select><button type="submit">Filter</button></form>
    <section className="dashboard-card post-table-card">{products.length ? <div className="post-table"><div className="post-table-head"><span>Product</span><span>Status</span><span>Updated</span><span>Actions</span></div>{products.map((product) => { const display = productDisplayStatus(product); return <article key={product._id.toString()}><div><strong>{product.title}</strong><p>{product.category} · {(product.technologies || []).slice(0, 3).join(", ") || "No technologies"}</p></div><span className={`post-status status-${display.toLowerCase()}`}>{display}</span><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(product.updatedAt)}</time><ProductRowActions productId={product._id.toString()} published={product.status === "published"} /></article>; })}</div> : <div className="dashboard-empty"><h3>No products found.</h3><p>Adjust the filters or create your first portfolio entry.</p><Link href="/dashboard/products/new">Create a product</Link></div>}</section>
    {pages > 1 && <nav className="pagination" aria-label="Products pagination">{page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}<span>Page {Math.min(page, pages)} of {pages}</span>{page < pages && <Link href={pageHref(page + 1)}>Next →</Link>}</nav>}
  </section>;
}
