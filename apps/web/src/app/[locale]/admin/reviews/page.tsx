import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ReviewActions } from '@/components/admin-controls';
import { RatingStars } from '@/components/rating-stars';
import { Pagination } from '@/components/pagination';
import type { Paged, Review } from '@mehrwearing/api-client';

interface AdminReviewsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

/** Review moderation queue: approve or reject before a review goes public. */
export default async function AdminReviewsPage({ params, searchParams }: AdminReviewsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status : 'PENDING';
  const page = Math.max(1, Number(sp.page) || 1);

  const t = await getTranslations('admin');
  const query = new URLSearchParams({
    status: status ?? 'PENDING',
    page: String(page),
    limit: '20',
  });
  const reviews = await api<Paged<Review>>(`/admin/reviews?${query.toString()}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((entry) => (
          <Link
            key={entry}
            href={`/${locale}/admin/reviews?status=${entry}`}
            className={`badge ${(status ?? 'PENDING') === entry ? 'badge-accent' : 'badge-muted'} hover:opacity-80`}
          >
            {entry === 'PENDING' ? `${t('pending')} · ` : ''}
            {entry}
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        {reviews.items.length === 0 && (
          <p className="card p-6 text-sm text-slate-500">{t('noReviews')}</p>
        )}

        {reviews.items.map((review) => (
          <article key={review.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{review.customerName}</span>
                  <RatingStars value={review.rating} locale={locale} />
                  <span className="badge badge-muted">{review.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  <bdi>{formatDate(review.createdAt, locale)}</bdi>
                  {review.productSlug && (
                    <>
                      {' · '}
                      <Link
                        href={`/${locale}/p/${review.productSlug}`}
                        className="font-bold text-orange-700 hover:underline"
                      >
                        {locale === 'fa-IR' ? 'محصول' : 'product'} ›
                      </Link>
                    </>
                  )}
                </p>
                {review.title && <h3 className="mt-2 font-bold text-slate-800">{review.title}</h3>}
                <p className="mt-1 text-sm leading-7 text-slate-600">{review.body}</p>
              </div>

              {review.status === 'PENDING' && <ReviewActions reviewId={review.id} />}
            </div>
          </article>
        ))}
      </section>

      <Pagination
        locale={locale}
        basePath="/admin/reviews"
        page={reviews.page}
        pages={reviews.pages}
        query={{ status: status ?? 'PENDING' }}
      />
    </div>
  );
}
