import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ProductEditor } from "../product-editor";
export const metadata: Metadata = { title: "New Product | VD Infotech" };
export default async function NewProductPage() { await requireUser(); return <section className="dashboard-content dashboard-editor-page"><ProductEditor /></section>; }
