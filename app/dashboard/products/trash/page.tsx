import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/product";
import { ProductTrashActions } from "../product-row-actions";

export const metadata: Metadata = { title: "Product Trash | VD Infotech" };
export default async function ProductTrashPage() {
  const user = await requireUser(); await connectToDatabase();
  const products = await Product.find({ author: user.id, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).lean().exec();
  return <section className="dashboard-content dashboard-post-manager"><div className="manager-heading"><div><p className="eyebrow"><span /> Recovery</p><h1>Product trash</h1><p>Restore products or permanently remove them with their uploaded media.</p></div><Link href="/dashboard/products">← Products</Link></div><section className="dashboard-card post-table-card">{products.length ? <div className="post-table"><div className="post-table-head"><span>Product</span><span>Status</span><span>Deleted</span><span>Actions</span></div>{products.map((product) => <article key={product._id.toString()}><div><strong>{product.title}</strong><p>{product.category}</p></div><span className="post-status status-trashed">Trashed</span><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(product.deletedAt!)}</time><ProductTrashActions productId={product._id.toString()} /></article>)}</div> : <div className="dashboard-empty"><h3>Product trash is empty.</h3><p>Deleted products will appear here.</p></div>}</section></section>;
}
