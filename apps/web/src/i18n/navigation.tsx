import { useMemo, type ComponentProps } from 'react';
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

const navigation = createNavigation(routing);

type LinkProps = ComponentProps<typeof navigation.Link>;
type RedirectArgs = Parameters<typeof navigation.redirect>[0];
type GetPathnameArgs = Parameters<typeof navigation.getPathname>[0];
type Router = ReturnType<typeof navigation.useRouter>;
type RouterHref = Parameters<Router['push']>[0];

/**
 * This app writes every link with an explicit locale (`/fa-IR/p/shirt`) — it
 * reads better in server code where `locale` is in scope, and it survives
 * copy/paste between pages. next-intl, however, adds the prefix *itself*, so
 * a raw `/fa-IR/...` href would become `/fa-IR/fa-IR/...`.
 *
 * These wrappers strip a leading locale segment before delegating, giving us
 * one convention everywhere: `Link`, `redirect`, `getPathname` and the router
 * all accept locale-prefixed hrefs and never double-prefix.
 */
function splitLocale(path: string): { pathname: string; locale?: string } {
  for (const locale of routing.locales) {
    if (path === `/${locale}`) return { pathname: '/', locale };
    if (path.startsWith(`/${locale}/`)) return { pathname: path.slice(locale.length + 1), locale };
  }
  return { pathname: path };
}

function normalizeHref<T>(href: T): T {
  if (typeof href === 'string') return splitLocale(href).pathname as T;
  if (href && typeof href === 'object' && 'pathname' in href) {
    const pathname = (href as { pathname?: unknown }).pathname;
    if (typeof pathname === 'string') {
      return { ...(href as object), pathname: splitLocale(pathname).pathname } as T;
    }
  }
  return href;
}

/** Locale-aware link (see module comment). */
export function Link(props: LinkProps) {
  return <navigation.Link {...props} href={normalizeHref(props.href)} />;
}

/**
 * Server-side redirect. Accepts the app-wide `'/fa-IR/…'` string form; the
 * locale is taken from the path (falling back to the default locale).
 */
export function redirect(
  target: string | RedirectArgs,
  type?: Parameters<typeof navigation.redirect>[1],
): never {
  if (typeof target === 'string') {
    const { pathname, locale } = splitLocale(target);
    return navigation.redirect({ href: pathname, locale: locale ?? routing.defaultLocale }, type);
  }
  return navigation.redirect({ ...target, href: normalizeHref(target.href) }, type);
}

/** Non-temporary variant of {@link redirect}. */
export function permanentRedirect(
  target: string | RedirectArgs,
  type?: Parameters<typeof navigation.permanentRedirect>[1],
): never {
  if (typeof target === 'string') {
    const { pathname, locale } = splitLocale(target);
    return navigation.permanentRedirect(
      { href: pathname, locale: locale ?? routing.defaultLocale },
      type,
    );
  }
  return navigation.permanentRedirect({ ...target, href: normalizeHref(target.href) }, type);
}

/** Localized pathname for a href (locale-prefix aware, like `Link`). */
export function getPathname(args: GetPathnameArgs): string {
  return navigation.getPathname({ ...args, href: normalizeHref(args.href) } as GetPathnameArgs);
}

/** Router whose `push`/`replace`/`prefetch` accept locale-prefixed hrefs. */
export function useRouter(): Router {
  const router = navigation.useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href: RouterHref, options?: Parameters<Router['push']>[1]) =>
        router.push(normalizeHref(href), options),
      replace: (href: RouterHref, options?: Parameters<Router['replace']>[1]) =>
        router.replace(normalizeHref(href), options),
      prefetch: (href: RouterHref, options?: Parameters<Router['prefetch']>[1]) =>
        router.prefetch(normalizeHref(href), options),
    }),
    [router],
  );
}

/** Current pathname **without** the locale prefix (next-intl semantics). */
export const usePathname = navigation.usePathname;
