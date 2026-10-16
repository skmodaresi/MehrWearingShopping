'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { ProductDetail, ProductVariant } from '@mehrwearing/api-client';
import { addToCartAction } from '@/actions/cart';
import { useCart } from './cart-context';
import { ApiErrorText } from './api-error';

/**
 * Variant picker + quantity + add-to-cart. Stock limits come from the API
 * (variant.stock) and every failure renders a localized message.
 */
export function AddToCart({ product, locale }: { product: ProductDetail; locale: string }) {
  const t = useTranslations('product');
  const tCart = useTranslations('cart');
  const router = useRouter();
  const { setCount } = useCart();

  const needsSize = useMemo(
    () => product.variants.some((variant) => variant.size),
    [product.variants],
  );
  const colors = useMemo(() => {
    const seen = new Map<string, ProductVariant>();
    for (const variant of product.variants) {
      if (variant.color && !seen.has(variant.color)) seen.set(variant.color, variant);
    }
    return Array.from(seen.values());
  }, [product.variants]);

  const [color, setColor] = useState<string | null>(colors[0]?.color ?? null);
  const sizes = useMemo(
    () => product.variants.filter((variant) => (color ? variant.color === color : true)),
    [product.variants, color],
  );
  const [size, setSize] = useState<string | null>(needsSize ? null : (sizes[0]?.size ?? null));
  const selected = useMemo(
    () =>
      product.variants.find((variant) => variant.size === size && variant.color === color) ?? null,
    [product.variants, size, color],
  );

  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const canAdd = Boolean(selected) && selected!.inStock && !busy;

  async function add() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const result = await addToCartAction(selected.id, qty);
    setBusy(false);
    if (result.error || !result.cart) {
      setError(result.error ?? 'GENERIC');
      return;
    }
    setCount(result.cart.itemCount);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="flex flex-col gap-5">
      {colors.length > 1 && (
        <div>
          <p className="label">{t('color')}</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((variant) => (
              <button
                key={variant.color}
                type="button"
                onClick={() => {
                  setColor(variant.color);
                  setSize(needsSize ? null : variant.size);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  color === variant.color
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {variant.colorHex && (
                  <span
                    className="h-4 w-4 rounded-full border border-white/60"
                    style={{ background: variant.colorHex }}
                  />
                )}
                {locale === 'fa-IR' ? variant.color : (variant.colorEn ?? variant.color)}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsSize && (
        <div>
          <p className="label">{t('size')}</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((variant) => (
              <button
                key={variant.sku}
                type="button"
                disabled={!variant.inStock}
                onClick={() => setSize(variant.size)}
                className={`min-w-11 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                  size === variant.size
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                } ${!variant.inStock ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
              >
                {variant.size}
              </button>
            ))}
          </div>
          {!size && <p className="mt-2 text-xs font-semibold text-orange-600">{t('selectSize')}</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            className="px-3 py-2 text-lg font-bold text-slate-600 disabled:opacity-40"
            onClick={() => setQty((value) => Math.max(1, value - 1))}
            disabled={qty <= 1}
            aria-label="-"
          >
            −
          </button>
          <span className="min-w-8 text-center text-sm font-bold">{qty}</span>
          <button
            type="button"
            className="px-3 py-2 text-lg font-bold text-slate-600 disabled:opacity-40"
            onClick={() => setQty((value) => Math.min(selected?.stock ?? 10, value + 1))}
            disabled={!selected || qty >= selected.stock}
            aria-label="+"
          >
            +
          </button>
        </div>

        <button type="button" onClick={add} disabled={!canAdd} className="btn btn-accent flex-1">
          {busy ? t('adding') : t('addToCart')}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/${locale}/cart`)}
          className="btn btn-outline"
          hidden={!added}
        >
          {tCart('checkout')}
        </button>
      </div>

      {added && <p className="text-sm font-semibold text-green-700">✓ {t('added')}</p>}
      {error && (
        <p className="text-sm font-semibold text-red-600">
          <ApiErrorText code={error} />
        </p>
      )}

      {selected && selected.inStock && selected.stock <= 5 && (
        <p className="text-sm font-semibold text-orange-600">
          {t('onlyLeft', { count: selected.stock })}
        </p>
      )}
      {selected && !selected.inStock && (
        <p className="text-sm font-semibold text-red-600">{t('outOfStock')}</p>
      )}

      <ul className="space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <li>✓ {t('guarantee')}</li>
        <li>✓ {t('shippingNote')}</li>
      </ul>
    </div>
  );
}
