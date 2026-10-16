import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import { getStoredLocaleKey, readStored, setStoredLocale } from './api';

export type Locale = 'fa-IR' | 'en';
export const LOCALES: Locale[] = ['fa-IR', 'en'];

type Dict = Record<string, string>;

/**
 * Persian is the product's primary language: it is the default and the
 * layout flips to RTL for it. Switching applies immediately to the copy;
 * the direction itself is re-applied on the next cold start (React Native
 * cannot mirror an already-rendered tree without an app reload).
 */
const messages: Record<Locale, Dict> = {
  'fa-IR': {
    'common.loading': 'در حال بارگذاری…',
    'common.error': 'خطایی رخ داد. دوباره تلاش کنید.',
    'common.retry': 'تلاش دوباره',
    'common.currency': 'تومان',
    'nav.catalog': 'فروشگاه',
    'nav.cart': 'سبد خرید',
    'nav.account': 'حساب من',
    'nav.search': 'جستجوی محصول…',
    'product.addToCart': 'افزودن به سبد',
    'product.added': 'به سبد اضافه شد',
    'product.outOfStock': 'ناموجود',
    'product.inStock': 'موجود',
    'product.size': 'سایز',
    'product.selectSize': 'یک سایز انتخاب کنید',
    'product.related': 'محصولات مرتبط',
    'product.brand': 'برند',
    'cart.title': 'سبد خرید',
    'cart.empty': 'سبد شما خالی است',
    'cart.subtotal': 'جمع کل',
    'cart.remove': 'حذف',
    'cart.checkout': 'تکمیل خرید در وب',
    'cart.loginToBuy': 'برای خرید وارد شوید',
    'auth.loginTitle': 'ورود به حساب',
    'auth.email': 'ایمیل',
    'auth.password': 'رمز عبور',
    'auth.fullName': 'نام و نام خانوادگی',
    'auth.loginCta': 'ورود',
    'auth.registerCta': 'ثبت‌نام',
    'auth.noAccount': 'حساب ندارید؟',
    'auth.hasAccount': 'قبلاً ثبت‌نام کرده‌اید؟',
    'auth.invalid': 'ایمیل یا رمز عبور اشتباه است.',
    'account.welcome': '{name} خوش آمدید',
    'account.logout': 'خروج از حساب',
    'account.language': 'زبان / Language',
    'account.directionNote': 'برای اعمال جهت صفحه، برنامه را یک بار ببندید و باز کنید.',
    'account.guest': 'ورود نکرده‌اید',
  },
  en: {
    'common.loading': 'Loading…',
    'common.error': 'Something went wrong. Please try again.',
    'common.retry': 'Retry',
    'common.currency': 'Toman',
    'nav.catalog': 'Shop',
    'nav.cart': 'Cart',
    'nav.account': 'Account',
    'nav.search': 'Search products…',
    'product.addToCart': 'Add to cart',
    'product.added': 'Added to cart',
    'product.outOfStock': 'Out of stock',
    'product.inStock': 'In stock',
    'product.size': 'Size',
    'product.selectSize': 'Select a size',
    'product.related': 'Related products',
    'product.brand': 'Brand',
    'cart.title': 'Shopping cart',
    'cart.empty': 'Your cart is empty',
    'cart.subtotal': 'Subtotal',
    'cart.remove': 'Remove',
    'cart.checkout': 'Checkout on the web',
    'cart.loginToBuy': 'Sign in to buy',
    'auth.loginTitle': 'Sign in',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full name',
    'auth.loginCta': 'Sign in',
    'auth.registerCta': 'Create account',
    'auth.noAccount': 'No account yet?',
    'auth.hasAccount': 'Already have an account?',
    'auth.invalid': 'Incorrect email or password.',
    'account.welcome': 'Welcome, {name}',
    'account.logout': 'Sign out',
    'account.language': 'زبان / Language',
    'account.directionNote': 'Restart the app once to apply the new layout direction.',
    'account.guest': 'Not signed in',
  },
};

interface I18nValue {
  locale: Locale;
  isRtl: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  pick: (fa: string, en: string) => string;
  formatPrice: (toman: number) => string;
  formatDate: (value: string | Date) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fa-IR');
  const [pending, setPending] = useState(true);

  useEffect(() => {
    void (async () => {
      const stored = await readStored(getStoredLocaleKey());
      const next = stored === 'en' ? 'en' : 'fa-IR';
      applyDirection(next);
      setLocaleState(next);
      setPending(false);
    })();
  }, []);

  function applyDirection(next: Locale) {
    const wantsRtl = next === 'fa-IR';
    I18nManager.allowRTL(wantsRtl);
    if (I18nManager.isRTL !== wantsRtl) I18nManager.forceRTL(wantsRtl);
  }

  function setLocale(next: Locale) {
    setLocaleState(next);
    setStoredLocale(next);
    applyDirection(next);
  }

  const value = useMemo<I18nValue>(() => {
    const dict = messages[locale];
    return {
      locale,
      isRtl: locale === 'fa-IR',
      setLocale,
      t: (key, params) => {
        let text = dict[key] ?? messages.en[key] ?? key;
        if (params) {
          for (const [name, replacement] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
          }
        }
        return text;
      },
      pick: (fa, en) => (locale === 'fa-IR' ? fa : en),
      formatPrice: (toman) =>
        `${new Intl.NumberFormat(locale === 'fa-IR' ? 'fa-IR' : 'en-US').format(toman)} ${dict['common.currency']}`,
      formatDate: (input) => {
        const date = typeof input === 'string' ? new Date(input) : input;
        if (Number.isNaN(date.getTime())) return '—';
        return new Intl.DateTimeFormat(locale === 'fa-IR' ? 'fa-IR-u-ca-persian' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(date);
      },
    };
  }, [locale]);

  if (pending) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
