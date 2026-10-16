'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createReviewAction } from '@/actions/account';
import { ApiErrorText } from './api-error';

/** Star rating + text review form (only rendered for signed-in purchasers). */
export function ReviewForm({ productId }: { productId: string }) {
  const t = useTranslations('product');
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('productId', productId);
    formData.set('rating', String(rating));
    setError(null);
    startTransition(async () => {
      const result = await createReviewAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
        ✓ {t('reviewPending')}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
      <h3 className="font-extrabold text-slate-900">{t('writeReview')}</h3>

      <div className="flex items-center gap-1" role="radiogroup" aria-label={t('writeReview')}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            onClick={() => setRating(value)}
            className={`text-2xl transition ${value <= rating ? 'text-amber-400' : 'text-slate-300 hover:text-amber-200'}`}
            aria-label={`${value}`}
          >
            ★
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="review-title">
          {t('reviewTitle')}
        </label>
        <input id="review-title" name="title" maxLength={80} className="input" />
      </div>

      <div>
        <label className="label" htmlFor="review-body">
          {t('reviewBody')}
        </label>
        <textarea
          id="review-body"
          name="body"
          required
          minLength={5}
          maxLength={2000}
          rows={4}
          className="input resize-none"
        />
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-600">
          <ApiErrorText code={error} />
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? '…' : t('reviewSubmit')}
      </button>
    </form>
  );
}
