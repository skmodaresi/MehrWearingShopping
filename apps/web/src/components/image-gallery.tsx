'use client';

import { useState } from 'react';

interface ImageEntry {
  url: string;
  altFa: string | null;
  altEn: string | null;
}

/** Thumbnail gallery: click a thumb to swap the hero image. */
export function ImageGallery({ images, alt }: { images: ImageEntry[]; alt: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="product-media grid place-items-center text-4xl">👕</div>;
  }
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <div className="product-media rounded-2xl border border-slate-200">
        <img src={current.url} alt={alt} width={900} height={900} />
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                index === active ? 'border-slate-900' : 'border-slate-200 hover:border-slate-400'
              }`}
              aria-label={`${index + 1}`}
            >
              <img
                src={image.url}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
