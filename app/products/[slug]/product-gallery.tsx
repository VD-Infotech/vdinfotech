"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type GalleryImage = { id: string; altText: string };
export function ProductGallery({ images, coverId, title }: { images: GalleryImage[]; coverId?: string; title: string }) {
  const start = Math.max(0, images.findIndex((image) => image.id === coverId));
  const [selected, setSelected] = useState(start); const [lightbox, setLightbox] = useState(false);
  const move = useCallback((amount: number) => setSelected((current) => (current + amount + images.length) % images.length), [images.length]);
  useEffect(() => {
    if (!lightbox) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") setLightbox(false); if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); };
    document.body.style.overflow = "hidden"; window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", keydown); };
  }, [lightbox, move]);
  if (!images.length) return null; const active = images[selected];
  return <div className="product-gallery"><button className="product-gallery-main" type="button" onClick={() => setLightbox(true)} aria-label="Open image gallery"><Image src={`/media/${active.id}`} alt={active.altText || title} width={1200} height={760} unoptimized priority /></button>{images.length > 1 && <div className="product-gallery-thumbs" aria-label="Product screenshots">{images.map((image, index) => <button className={index === selected ? "is-active" : ""} type="button" onClick={() => setSelected(index)} key={image.id} aria-label={`View image ${index + 1}`}><Image src={`/media/${image.id}`} alt="" width={180} height={110} unoptimized /></button>)}</div>}
    {lightbox && <div className="product-lightbox" role="dialog" aria-modal="true" aria-label="Product image viewer" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(false); }}><button className="lightbox-close" type="button" onClick={() => setLightbox(false)} aria-label="Close gallery">×</button>{images.length > 1 && <button className="lightbox-prev" type="button" onClick={() => move(-1)} aria-label="Previous image">←</button>}<Image src={`/media/${active.id}`} alt={active.altText || title} width={1600} height={1000} unoptimized />{images.length > 1 && <button className="lightbox-next" type="button" onClick={() => move(1)} aria-label="Next image">→</button>}<span>{selected + 1} / {images.length}</span></div>}
  </div>;
}
