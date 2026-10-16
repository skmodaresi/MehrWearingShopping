'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { OrderStatus } from '@mehrwearing/api-client';
import {
  setOrderStatusAction,
  setReviewStatusAction,
  updateProductAction,
  updateVariantStockAction,
} from '@/actions/admin';
import { ApiErrorText } from './api-error';

const ORDER_STATUSES: OrderStatus[] = [
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

function useMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; code?: string } | null>(null);

  const run = (operation: () => Promise<{ ok?: boolean; error?: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await operation();
      if (result.error) setMessage({ kind: 'error', code: result.error });
      else {
        setMessage({ kind: 'ok' });
        router.refresh();
      }
    });
  };

  return { pending, message, run };
}

function Message({ message }: { message: { kind: 'ok' | 'error'; code?: string } | null }) {
  const t = useTranslations('admin');
  if (!message) return null;
  if (message.kind === 'ok')
    return <span className="text-xs font-bold text-green-700">✓ {t('statusUpdated')}</span>;
  return (
    <span className="text-xs font-bold text-red-600">
      <ApiErrorText code={message.code ?? 'GENERIC'} />
    </span>
  );
}

/** Admin order row status changer (mirrors the API state machine). */
export function OrderStatusSelect({ orderId, current }: { orderId: string; current: OrderStatus }) {
  const t = useTranslations('admin');
  const { pending, message, run } = useMutation();
  const [next, setNext] = useState<OrderStatus | ''>('');

  return (
    <div className="flex items-center gap-2">
      <select
        value={next}
        onChange={(event) => setNext(event.target.value as OrderStatus | '')}
        className="input w-auto py-1.5 text-xs"
        aria-label={t('selectStatus')}
      >
        <option value="">{current}</option>
        {ORDER_STATUSES.filter((status) => status !== current).map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!next || pending}
        onClick={() => next && run(() => setOrderStatusAction(orderId, next))}
        className="btn btn-primary btn-sm"
      >
        {t('changeStatus')}
      </button>
      <Message message={message} />
    </div>
  );
}

/** Approve / reject a pending review. */
export function ReviewActions({ reviewId }: { reviewId: string }) {
  const t = useTranslations('admin');
  const { pending, message, run } = useMutation();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setReviewStatusAction(reviewId, 'APPROVED'))}
        className="btn btn-outline btn-sm border-green-300 text-green-700"
      >
        {t('approve')}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setReviewStatusAction(reviewId, 'REJECTED'))}
        className="btn btn-outline btn-sm border-red-300 text-red-600"
      >
        {t('reject')}
      </button>
      <Message message={message} />
    </div>
  );
}

/** Inline absolute stock editor (records an inventory movement server-side). */
export function StockEditor({
  productId,
  variantId,
  stock,
}: {
  productId: string;
  variantId: string;
  stock: number;
}) {
  const t = useTranslations('admin');
  const { pending, message, run } = useMutation();
  const [value, setValue] = useState(String(stock));

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="input w-20 py-1 text-sm"
        aria-label={t('stock')}
      />
      <button
        type="button"
        disabled={pending || Number(value) === stock}
        onClick={() => run(() => updateVariantStockAction(productId, variantId, Number(value)))}
        className="btn btn-outline btn-sm"
      >
        {t('update')}
      </button>
      <Message message={message} />
    </div>
  );
}

/** Inline price + featured editor for the product table. */
export function ProductRowEditor({
  productId,
  priceToman,
  isFeatured,
  status,
}: {
  productId: string;
  priceToman: number;
  isFeatured: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'HIDDEN';
}) {
  const t = useTranslations('admin');
  const { pending, message, run } = useMutation();
  const [price, setPrice] = useState(String(priceToman));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        step={1000}
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        className="input w-32 py-1 text-sm"
        aria-label={t('price')}
      />
      <button
        type="button"
        disabled={pending || Number(price) === priceToman}
        onClick={() => run(() => updateProductAction(productId, { priceToman: Number(price) }))}
        className="btn btn-outline btn-sm"
      >
        {t('update')}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() =>
            updateProductAction(productId, { status: status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' }),
          )
        }
        className={`btn btn-sm ${status === 'ACTIVE' ? 'btn-ghost' : 'btn-accent'}`}
      >
        {status === 'ACTIVE' ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => updateProductAction(productId, { isFeatured: !isFeatured }))}
        className={`btn btn-sm ${isFeatured ? 'btn-accent' : 'btn-ghost'}`}
        title="featured"
      >
        ★
      </button>
      <Message message={message} />
    </div>
  );
}
