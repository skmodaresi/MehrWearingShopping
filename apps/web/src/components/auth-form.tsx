'use client';

import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { loginAction, registerAction, type ActionState } from '@/actions/auth';
import { ApiErrorText } from './api-error';

const initialState: ActionState = {};

/** Login/register form driven by React 19 `useActionState`. */
export function AuthForm({
  mode,
  locale,
  nextPath,
}: {
  mode: 'login' | 'register';
  locale: string;
  nextPath?: string;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      router.push(nextPath && nextPath.startsWith('/') ? nextPath : `/${locale}/account`);
      router.refresh();
    }
  }, [state, router, locale, nextPath]);

  return (
    <form
      action={formAction}
      className="card mx-auto flex w-full max-w-md flex-col gap-4 p-6 sm:p-8"
    >
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {mode === 'login' ? t('loginTitle') : t('registerTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'login' ? t('loginText') : t('registerText')}
        </p>
      </div>

      {mode === 'register' && (
        <div>
          <label className="label" htmlFor="fullName">
            {t('fullName')}
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            minLength={2}
            maxLength={80}
            className="input"
          />
        </div>
      )}

      <div>
        <label className="label" htmlFor="email">
          {t('email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          dir="ltr"
          className="input"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          {t('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          dir="ltr"
          className="input"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      {mode === 'register' && (
        <>
          <div>
            <label className="label" htmlFor="phone">
              {t('phoneOptional')}
            </label>
            <input id="phone" name="phone" dir="ltr" placeholder="09123456789" className="input" />
          </div>
          <input type="hidden" name="locale" value={locale} />
        </>
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          <ApiErrorText code={state.error} />
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? '…' : mode === 'login' ? t('loginCta') : t('registerCta')}
      </button>

      <p className="text-center text-sm text-slate-500">
        {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
        <a
          className="font-bold text-orange-700 hover:underline"
          href={`/${locale}/auth/${mode === 'login' ? 'register' : 'login'}${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
        >
          {mode === 'login' ? t('registerCta') : t('loginCta')}
        </a>
      </p>
    </form>
  );
}
