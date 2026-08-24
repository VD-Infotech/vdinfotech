import "server-only";

import { Schema, model, models } from "mongoose";

const productSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    summary: { type: String, required: true, trim: true, maxlength: 320 },
    contentHtml: { type: String, required: true },
    contentText: { type: String, required: true },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    technologies: [{ type: String, trim: true, maxlength: 40 }],
    galleryMedia: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    coverMedia: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    liveDemoUrl: { type: String, trim: true, maxlength: 500, default: "" },
    featured: { type: Boolean, default: false, index: true },
    displayOrder: { type: Number, min: 0, max: 9999, default: 0 },
    seoTitle: { type: String, trim: true, maxlength: 70, default: "" },
    seoDescription: { type: String, trim: true, maxlength: 170, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

productSchema.index(
  { title: "text", summary: "text", contentText: "text", category: "text", tags: "text", technologies: "text" },
  { weights: { title: 10, summary: 6, category: 5, tags: 4, technologies: 4, contentText: 1 } },
);
productSchema.index({ author: 1, deletedAt: 1, updatedAt: -1 });
productSchema.index({ status: 1, deletedAt: 1, publishedAt: -1 });
productSchema.index({ featured: -1, displayOrder: 1, publishedAt: -1 });

export const Product = models.Product || model("Product", productSchema);
