import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl request config lives at src/i18n/request.ts (plugin default path).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The storefront talks to the API exclusively from the server (BFF pattern):
  // no browser → API calls, no CORS, tokens stay in httpOnly cookies.
  outputFileTracingExcludes: { '*': ['./node_modules/**'] },
};

export default withNextIntl(nextConfig);
