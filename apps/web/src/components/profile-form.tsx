'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { User } from '@mehrwearing/api-client';
import { updateProfileAction } from '@/actions/account';
import { ApiErrorText } from './api-error';

/** Profile editor (name + phone) driven by a server action. */
export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('profile')}</h2>

      {saved && (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          ✓ {tCommon('saved')}
        </p>
      )}

      <form onSubmit={submit} className="grid max-w-md gap-4">
        <div>
          <label className="label" htmlFor="fullName">
            {tAuth('fullName')}
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            minLength={2}
            maxLength={80}
            defaultValue={user.fullName}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="phone">
            {tAuth('phoneOptional')}
          </label>
          <input
            id="phone"
            name="phone"
            dir="ltr"
            defaultValue={user.phone ?? ''}
            placeholder="09123456789"
            className="input"
          />
        </div>

        <div>
          <span className="label">{tAuth('email')}</span>
          <bdi className="block text-sm text-slate-500">{user.email}</bdi>
        </div>

        {error && (
          <p className="text-sm font-bold text-red-600">
            <ApiErrorText code={error} />
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary w-fit">
          {tCommon('save')}
        </button>
      </form>
    </section>
  );
}
