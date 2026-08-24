import Link from "next/link";
import {
  moveProductToTrashAction, permanentlyDeleteProductAction, restoreProductAction, unpublishProductAction,
} from "@/app/actions/products";

export function ProductRowActions({ productId, published }: { productId: string; published: boolean }) {
  return <div className="post-row-actions">
    <Link href={`/dashboard/products/${productId}/edit`}>Edit</Link>
    <Link href={`/dashboard/products/${productId}/preview`} target="_blank">Preview</Link>
    {published && <form action={unpublishProductAction}><input type="hidden" name="productId" value={productId} /><button type="submit">Unpublish</button></form>}
    <form action={moveProductToTrashAction}><input type="hidden" name="productId" value={productId} /><button type="submit">Trash</button></form>
  </div>;
}

export function ProductTrashActions({ productId }: { productId: string }) {
  return <div className="post-row-actions">
    <form action={restoreProductAction}><input type="hidden" name="productId" value={productId} /><button type="submit">Restore</button></form>
    <form action={permanentlyDeleteProductAction}><input type="hidden" name="productId" value={productId} /><button className="danger-action" type="submit">Delete forever</button></form>
  </div>;
}
