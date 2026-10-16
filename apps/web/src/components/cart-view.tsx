'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Cart, CartItem } from '@mehrwearing/api-client';
import { removeFromCartAction, updateCartAction } from '@/actions/cart';
import { formatPrice, pickLocalized } from '@/lib/format';
import { useCart } from './cart-context';
import { ApiErrorText } from './api-error';

/**
 * Interactive cart table. Every mutation round-trips through a server action
 * and the API is the source of truth — this component only mirrors the result.
 */
export function CartView({ cart, locale }: { cart: Cart; locale: string }) {
  const t = useTranslations('cart');
  const { setCount, refresh } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function mutate(key: string, operation: () => Promise<{ cart?: Cart; error?: string }>) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await operation();
      setBusy(null);
      if (result.error || !result.cart) {
        setError(result.error ?? 'GENERIC');
        return;
      }
      setCount(result.cart.itemCount);
      await refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
              <th className="p-4 text-start font-bold">{t('item')}</th>
              <th className="p-4 text-start font-bold">{t('price')}</th>
              <th className="p-4 text-start font-bold">{t('qty')}</th>
              <th className="p-4 text-start font-bold">{t('total')}</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {cart.items.map((item) => (
              <CartRow
                key={item.variantId}
                item={item}
                locale={locale}
                busy={busy === item.variantId}
                onUpdate={(qty) =>
                  mutate(item.variantId, () => updateCartAction(item.variantId, qty))
                }
                onRemove={() => mutate(item.variantId, () => removeFromCartAction(item.variantId))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm font-bold text-red-600">
          <ApiErrorText code={error} />
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/${locale}/products`} className="btn btn-outline">
          {t('continueShopping')}
        </Link>
        <div className="card flex flex-col gap-3 p-5 sm:min-w-72">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>{t('subtotal')}</span>
            <span className="font-bold text-slate-900">
              {formatPrice(cart.subtotalToman, locale)}
            </span>
          </div>
          <Link href={`/${locale}/checkout`} className="btn btn-accent w-full">
            {t('checkout')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function CartRow({
  item,
  locale,
  busy,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  locale: string;
  busy: boolean;
  onUpdate: (qty: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('cart');
  const name = pickLocalized(locale, item.product.nameFa, item.product.nameEn);
  const variantLabel = [
    item.size,
    item.color ? pickLocalized(locale, item.color, item.colorEn ?? item.color) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
            {item.product.image && (
              <img
                src={item.product.image}
                alt={name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="min-w-0">
            <Link
              href={`/${locale}/p/${item.product.slug}`}
              className="block font-bold text-slate-900 hover:text-orange-700"
            >
              {name}
            </Link>
            {variantLabel && (
              <span className="mt-0.5 block text-xs text-slate-500">{variantLabel}</span>
            )}
            {!item.available && (
              <span className="mt-1 block text-xs font-bold text-red-600">{t('unavailable')}</span>
            )}
          </span>
        </div>
      </td>
      <td className="p-4 whitespace-nowrap text-slate-600">
        {formatPrice(item.unitPriceToman, locale)}
      </td>
      <td className="p-4">
        <div className="flex w-fit items-center rounded-xl border border-slate-300">
          <button
            type="button"
            className="px-3 py-1.5 text-lg font-bold text-slate-600 disabled:opacity-40"
            disabled={busy || item.qty <= 1}
            onClick={() => onUpdate(item.qty - 1)}
            aria-label="-"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
          <button
            type="button"
            className="px-3 py-1.5 text-lg font-bold text-slate-600 disabled:opacity-40"
            disabled={busy || item.qty >= item.stock}
            onClick={() => onUpdate(item.qty + 1)}
            aria-label="+"
          >
            +
          </button>
        </div>
      </td>
      <td className="p-4 whitespace-nowrap font-extrabold text-slate-900">
        {formatPrice(item.lineTotalToman, locale)}
      </td>
      <td className="p-4 text-end">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-xs font-bold text-slate-400 hover:text-red-600"
        >
          {t('remove')}
        </button>
      </td>
    </tr>
  );
}
