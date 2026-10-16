/**
 * Persian/English text utilities shared by catalog search, slugs and
 * formatting. Persian search works by folding both the stored haystack
 * (`Product.searchText`) and the incoming query through the same normalizer,
 * so Arabic/Persian keyboard variants, ZWNJ and Persian numerals all match.
 */

const ARABIC_TO_PERSIAN: Record<string, string> = {
  ي: 'ی',
  ى: 'ی',
  إ: 'ا',
  أ: 'ا',
  ٱ: 'ا',
  ك: 'ک',
  ة: 'ه',
  ؤ: 'و',
  ئ: 'ی',
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** ۱۲۳ / ١٢٣ → 123 */
export function toEnglishDigits(value: string): string {
  let output = '';
  for (const char of value) {
    const pIndex = PERSIAN_DIGITS.indexOf(char);
    const aIndex = ARABIC_DIGITS.indexOf(char);
    if (pIndex !== -1) output += String(pIndex);
    else if (aIndex !== -1) output += String(aIndex);
    else output += char;
  }
  return output;
}

/** 123 → ۱۲۳ (Persian extended digits) */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/**
 * Canonical search form: lowercase, Arabic folds into Persian, ZWNJ becomes a
 * space (so «تی‌شرت» matches a query for «تی شرت»), diacritics stripped,
 * digits Latinized, whitespace collapsed.
 */
export function normalizeForSearch(value: string): string {
  let output = '';
  for (const char of value.toLowerCase()) {
    if (char === '\u200c' || char === '\u200d') {
      output += ' '; // ZWNJ/ZWJ in compound words → word boundary
      continue;
    }
    if (char === '\u200e' || char === '\u200f') continue;
    output += ARABIC_TO_PERSIAN[char] ?? char;
  }
  output = toEnglishDigits(output);
  output = output.replace(/[ً-ْٰ]/g, '');
  return output.replace(/\s+/g, ' ').trim();
}

/** URL-safe slug; falls back to `fallback` when nothing ASCII remains. */
export function slugify(value: string, fallback: string): string {
  const slug = normalizeForSearch(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  // Persian slugs are valid but awkward in APIs — only accept ASCII slugs.
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? slug : fallback;
}

/** Builds an SQL ILIKE pattern with the wildcards escaped. */
export function ilikePattern(value: string): string {
  const escaped = normalizeForSearch(value).replace(/[%_\\]/g, '\\$&');
  return `%${escaped}%`;
}
