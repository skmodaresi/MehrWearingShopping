import { normalizeForSearch, slugify, toEnglishDigits, toPersianDigits } from './persian';

describe('Persian text utilities', () => {
  it('converts Persian and Arabic-Indic digits to ASCII', () => {
    expect(toEnglishDigits('۱۲۳۴۵')).toBe('12345');
    expect(toEnglishDigits('٠١٢')).toBe('012');
    expect(toEnglishDigits('abc۹')).toBe('abc9');
  });

  it('converts ASCII digits to Persian digits', () => {
    expect(toPersianDigits(1490000)).toBe('۱۴۹۰۰۰۰');
    expect(toPersianDigits('123')).toBe('۱۲۳');
  });

  it('folds Arabic letter variants into Persian ones', () => {
    // ي → ی, ك → ک (Arabic keyboard vs Persian keyboard)
    expect(normalizeForSearch('جين')).toBe(normalizeForSearch('جین'));
    expect(normalizeForSearch('كتاب')).toBe(normalizeForSearch('کتاب'));
  });

  it('turns ZWNJ into a word boundary and collapses whitespace', () => {
    expect(normalizeForSearch('می\u200cخواهم')).toBe('می خواهم');
    expect(normalizeForSearch('  تی‌شرت  مردانه ')).toBe('تی شرت مردانه');
    // both spellings now hit the same haystack
    expect(normalizeForSearch('تی‌شرت')).toBe(normalizeForSearch('تی شرت'));
  });

  it('lowercases latin text and latinizes persian digits', () => {
    expect(normalizeForSearch('Slim Fit ۱۲')).toBe('slim fit 12');
  });

  it('builds ASCII slugs and falls back for pure Persian input', () => {
    expect(slugify('Slim Fit Jeans', 'fallback')).toBe('slim-fit-jeans');
    expect(slugify('  Oxford Shirt!! ', 'fallback')).toBe('oxford-shirt');
    expect(slugify('پیراهن آکسفورد', 'fallback-123')).toBe('fallback-123');
  });
});
