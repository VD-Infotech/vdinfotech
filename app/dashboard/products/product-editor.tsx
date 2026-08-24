"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import { saveProductAction, type ProductFormState } from "@/app/actions/products";
import { AdvancedLinkDialog, type AdvancedLinkValue } from "@/app/dashboard/posts/advanced-link-dialog";

type GalleryImage = { id: string; url: string; altText: string };
export type EditableProduct = {
  id: string; title: string; summary: string; category: string; tags: string[]; technologies: string[];
  contentHtml: string; liveDemoUrl: string; featured: boolean; displayOrder: number;
  seoTitle: string; seoDescription: string; publishedAt: string; status: "draft" | "published";
  coverMediaId: string; gallery: GalleryImage[];
};

const RichTextLink = TiptapLink.extend({
  addAttributes() { return { ...this.parent?.(), download: { default: null, parseHTML: (element) => element.hasAttribute("download") ? element.getAttribute("download") || "" : null, renderHTML: (attributes) => attributes.download !== null ? { download: attributes.download || "" } : {} } }; },
});
function ErrorText({ errors }: { errors?: string[] }) { return errors?.length ? <p className="editor-error">{errors.join(" ")}</p> : null; }
function Submit({ intent, children }: { intent: "draft" | "publish" | "schedule"; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className={`editor-submit editor-${intent}`} type="submit" name="intent" value={intent} disabled={pending}>{pending ? "Saving..." : children}</button>;
}
async function uploadImage(file: File, altText: string): Promise<GalleryImage> {
  const data = new FormData(); data.set("image", file); data.set("altText", altText);
  const response = await fetch("/api/media", { method: "POST", body: data }); const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Image upload failed."); return result;
}
async function deleteUnattached(id: string) { await fetch(`/api/media/${id}`, { method: "DELETE" }).catch(() => undefined); }

function localScheduleValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ProductEditor({ product }: { product?: EditableProduct }) {
  const [state, formAction] = useActionState(saveProductAction, {} as ProductFormState);
  const [fields, setFields] = useState(() => ({
    title: product?.title || "",
    summary: product?.summary || "",
    category: product?.category || "",
    technologies: product?.technologies.join(", ") || "",
    tags: product?.tags.join(", ") || "",
    liveDemoUrl: product?.liveDemoUrl || "",
    publishedAt: localScheduleValue(product?.publishedAt),
    featured: product?.featured || false,
    displayOrder: String(product?.displayOrder || 0),
    seoTitle: product?.seoTitle || "",
    seoDescription: product?.seoDescription || "",
  }));
  const [contentHtml, setContentHtml] = useState(product?.contentHtml || "<p></p>");
  const [gallery, setGallery] = useState<GalleryImage[]>(product?.gallery || []);
  const [coverMediaId, setCoverMediaId] = useState(product?.coverMediaId || "");
  const [uploading, setUploading] = useState(false); const [uploadError, setUploadError] = useState("");
  const [dirty, setDirty] = useState(false); const [draggedId, setDraggedId] = useState("");
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; value: AdvancedLinkValue }>({ open: false, value: { href: "", target: "_blank", rel: "noopener noreferrer", download: null } });
  const galleryInput = useRef<HTMLInputElement>(null); const inlineInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({ immediatelyRender: false, extensions: [StarterKit.configure({ link: false }), RichTextLink.configure({ openOnClick: false }), Image.configure({ allowBase64: false, HTMLAttributes: { loading: "lazy" } })], content: product?.contentHtml || "<p></p>", editorProps: { attributes: { class: "post-editor-surface", "aria-label": "Product description" } }, onUpdate({ editor: current }) { setContentHtml(current.getHTML()); setDirty(true); } });

  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const uploadGallery = async (files: FileList) => {
    setUploadError(""); const available = 12 - gallery.length; const selected = [...files].slice(0, available);
    if (files.length > available) setUploadError(`Only ${available} more gallery image${available === 1 ? "" : "s"} can be added.`);
    setUploading(true);
    try {
      for (const file of selected) {
        const uploaded = await uploadImage(file, fields.title || "Product gallery image");
        setGallery((current) => [...current, uploaded]);
        setCoverMediaId((current) => current || uploaded.id);
      }
      setDirty(true);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Image upload failed."); }
    finally { setUploading(false); }
  };
  const uploadInline = async (file: File) => {
    setUploadError(""); setUploading(true);
    try { const image = await uploadImage(file, fields.title || "Product image"); editor?.chain().focus().setImage({ src: image.url, alt: image.altText }).run(); setDirty(true); }
    catch (error) { setUploadError(error instanceof Error ? error.message : "Image upload failed."); } finally { setUploading(false); }
  };
  const removeGalleryImage = async (image: GalleryImage) => {
    if (!product || !product.gallery.some((item) => item.id === image.id)) await deleteUnattached(image.id);
    const next = gallery.filter((item) => item.id !== image.id); setGallery(next);
    if (coverMediaId === image.id) setCoverMediaId(next[0]?.id || ""); setDirty(true);
  };
  const moveImage = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setGallery((current) => { const next = [...current]; const from = next.findIndex((item) => item.id === draggedId); const to = next.findIndex((item) => item.id === targetId); const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }); setDraggedId(""); setDirty(true);
  };
  const openLink = () => {
    const attributes = editor?.getAttributes("link") || {};
    setLinkDialog({ open: true, value: { href: attributes.href || "", target: attributes.target === "_blank" ? "_blank" : null, rel: attributes.rel || null, download: attributes.download ?? null } });
  };
  const removeSelectedImage = async () => {
    if (!editor || !editor.isActive("image")) return;
    const src = String(editor.getAttributes("image").src || "");
    editor.chain().focus().deleteSelection().run();
    const id = /\/media\/([a-f0-9]{24})/.exec(src)?.[1];
    if (id && (!product || !product.contentHtml.includes(src))) await deleteUnattached(id);
    setDirty(true);
  };
  return <form className="post-editor-form" action={formAction} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
    <input type="hidden" name="productId" value={product?.id || ""} /><input type="hidden" name="contentHtml" value={contentHtml} />
    <input type="hidden" name="gallery" value={JSON.stringify(gallery.map(({ id, altText }) => ({ id, altText })))} /><input type="hidden" name="coverMediaId" value={coverMediaId} /><input type="hidden" name="timezoneOffset" value={new Date().getTimezoneOffset()} />
    <div className="editor-page-heading"><div><p className="eyebrow"><span /> {product ? "Edit product" : "New product"}</p><h1>{product ? "Refine your showcase." : "Show what you built."}</h1></div><div className="editor-heading-actions">{product && <Link href={`/dashboard/products/${product.id}/preview`} target="_blank">Preview ↗</Link>}<Submit intent="draft">Save draft</Submit><Submit intent="publish">Publish now</Submit></div></div>
    {state.message && <p className={state.success ? "editor-success" : "editor-error"} role="status">{state.message}</p>}
    <div className="editor-layout"><div className="editor-main">
      <label className="editor-field"><span>Product title</span><input name="title" value={fields.title} onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} maxLength={160} required placeholder="A clear product name" /><ErrorText errors={state.errors?.title} /></label>
      <label className="editor-field"><span>Short summary</span><textarea name="summary" value={fields.summary} onChange={(event) => setFields((current) => ({ ...current, summary: event.target.value }))} maxLength={320} rows={3} required placeholder="What the product does and why it matters" /><ErrorText errors={state.errors?.summary} /></label>
      <div className="rich-editor-wrap"><div className="rich-editor-label"><span>Case-study description</span><small>Rich text</small></div><div className="editor-toolbar">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button><button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button><button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button><button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</button><button type="button" onClick={openLink}>Link</button><button type="button" onClick={() => inlineInput.current?.click()} disabled={uploading}>Image</button>{editor?.isActive("image") && <button type="button" onClick={() => void removeSelectedImage()}>Remove image</button>}<button type="button" onClick={() => editor?.chain().focus().undo().run()}>Undo</button><button type="button" onClick={() => editor?.chain().focus().redo().run()}>Redo</button>
      </div><EditorContent editor={editor} /><input ref={inlineInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadInline(file); event.target.value = ""; }} /><ErrorText errors={state.errors?.contentHtml} /></div>
      <section className="product-gallery-editor"><div className="rich-editor-label"><span>Gallery</span><small>{gallery.length}/12 · drag to reorder</small></div><button className="cover-upload" type="button" disabled={uploading || gallery.length >= 12} onClick={() => galleryInput.current?.click()}>{uploading ? "Uploading..." : "+ Add gallery images"}</button><input ref={galleryInput} hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { if (event.target.files) void uploadGallery(event.target.files); event.target.value = ""; }} />
        {gallery.length > 0 && <div className="product-gallery-editor-grid">{gallery.map((image) => <article key={image.id} draggable onDragStart={() => setDraggedId(image.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveImage(image.id)}><NextImage src={image.url} alt={image.altText || "Gallery preview"} width={360} height={220} unoptimized /><label><input type="radio" checked={coverMediaId === image.id} onChange={() => { setCoverMediaId(image.id); setDirty(true); }} /> Cover</label><input aria-label="Image alt text" value={image.altText} maxLength={180} placeholder="Describe this image" onChange={(event) => setGallery((current) => current.map((item) => item.id === image.id ? { ...item, altText: event.target.value } : item))} /><button type="button" onClick={() => void removeGalleryImage(image)}>Remove</button></article>)}</div>}
        <ErrorText errors={state.errors?.gallery} />{uploadError && <p className="editor-error">{uploadError}</p>}
      </section>
    </div><aside className="editor-settings">
      <section className="editor-settings-card"><h2>Publishing</h2><label className="editor-field"><span>Schedule date and time</span><input name="publishedAt" type="datetime-local" value={fields.publishedAt} onChange={(event) => setFields((current) => ({ ...current, publishedAt: event.target.value }))} /><ErrorText errors={state.errors?.publishedAt} /></label><Submit intent="schedule">Schedule product</Submit><p>Dates use your browser&apos;s local time.</p></section>
      <section className="editor-settings-card"><h2>Organization</h2><label className="editor-field"><span>Category</span><input name="category" value={fields.category} onChange={(event) => setFields((current) => ({ ...current, category: event.target.value }))} maxLength={60} required placeholder="Fintech" /><ErrorText errors={state.errors?.category} /></label><label className="editor-field"><span>Technologies</span><input name="technologies" value={fields.technologies} onChange={(event) => setFields((current) => ({ ...current, technologies: event.target.value }))} placeholder="Next.js, TypeScript, MongoDB" /><small>Up to 8 comma-separated items</small></label><label className="editor-field"><span>Tags</span><input name="tags" value={fields.tags} onChange={(event) => setFields((current) => ({ ...current, tags: event.target.value }))} placeholder="dashboard, analytics, saas" /><small>Up to 8 comma-separated tags</small></label></section>
      <section className="editor-settings-card"><h2>Live demo</h2><label className="editor-field"><span>HTTPS URL</span><input name="liveDemoUrl" type="url" value={fields.liveDemoUrl} onChange={(event) => setFields((current) => ({ ...current, liveDemoUrl: event.target.value }))} maxLength={500} placeholder="https://demo.example.com" /><ErrorText errors={state.errors?.liveDemoUrl} /></label></section>
      <section className="editor-settings-card"><h2>Homepage</h2><label className="link-toggle"><input name="featured" type="checkbox" checked={fields.featured} onChange={(event) => setFields((current) => ({ ...current, featured: event.target.checked }))} /><span><strong>Featured product</strong><small>Prioritize this product in Selected Work</small></span></label><label className="editor-field"><span>Display order</span><input name="displayOrder" type="number" min={0} max={9999} value={fields.displayOrder} onChange={(event) => setFields((current) => ({ ...current, displayOrder: event.target.value }))} /></label></section>
      <details className="editor-settings-card editor-seo" open><summary>Search appearance</summary><label className="editor-field"><span>SEO title</span><input name="seoTitle" value={fields.seoTitle} onChange={(event) => setFields((current) => ({ ...current, seoTitle: event.target.value }))} maxLength={70} placeholder="Defaults to product title" /><ErrorText errors={state.errors?.seoTitle} /></label><label className="editor-field"><span>SEO description</span><textarea name="seoDescription" value={fields.seoDescription} onChange={(event) => setFields((current) => ({ ...current, seoDescription: event.target.value }))} maxLength={170} rows={4} placeholder="Defaults to summary" /><ErrorText errors={state.errors?.seoDescription} /></label></details>
    </aside></div>
    {linkDialog.open && <AdvancedLinkDialog initialValue={linkDialog.value} productId={product?.id} onClose={() => setLinkDialog((current) => ({ ...current, open: false }))} onApply={(value) => { editor?.chain().focus().extendMarkRange("link").setMark("link", value).run(); setLinkDialog((current) => ({ ...current, open: false })); setDirty(true); }} onRemove={() => { const downloadId = /^\/download\/([a-f0-9]{24})$/.exec(linkDialog.value.href)?.[1]; editor?.chain().focus().extendMarkRange("link").unsetLink().run(); if (downloadId && !product?.contentHtml.includes(linkDialog.value.href)) void fetch(`/api/files/${downloadId}`, { method: "DELETE" }); setLinkDialog((current) => ({ ...current, open: false })); setDirty(true); }} />}
  </form>;
}
