import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { AccountAddresses } from '@/components/account-addresses';
import type { Address } from '@mehrwearing/api-client';

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Address book: add, list and remove delivery addresses. */
export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await getSessionUser();
  if (!viewer)
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/addresses`)}`);

  const t = await getTranslations('account');
  const addresses = await api<Address[]>('/users/me/addresses');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">{t('addresses')}</h1>
      <AccountAddresses addresses={addresses} />
    </div>
  );
}
