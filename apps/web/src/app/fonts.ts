import localFont from 'next/font/local';

/**
 * Vazirmatn — the de-facto Persian UI typeface (SIL OFL), self-hosted from
 * the repo so builds never depend on Google Fonts availability. The variable
 * file covers weights 100–900; Latin text falls back to the system stack.
 */
export const vazirmatn = localFont({
  src: [
    {
      path: './fonts/Vazirmatn-variable.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
  fallback: ['Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
  adjustFontFallback: false,
});
