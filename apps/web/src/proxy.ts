import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This single file keeps
 * every URL locale-prefixed and redirects bare `/` to the Persian default.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and any path with a file extension.
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
