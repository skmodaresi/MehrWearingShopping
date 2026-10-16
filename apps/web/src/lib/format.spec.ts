import {
  daysSince,
  formatDate,
  formatNumber,
  formatPrice,
  formatRating,
  isFa,
  pickLocalized,
} from './format';

describe('locale formatting', () => {
  it('detects the Persian locale family', () => {
    expect(isFa('fa-IR')).toBe(true);
    expect(isFa('en')).toBe(false);
  });

  it('picks the right language column', () => {
    expect(pickLocalized('fa-IR', 'پیراهن آکسفورد', 'Oxford Shirt')).toBe('پیراهن آکسفورد');
    expect(pickLocalized('en', 'پیراهن آکسفورد', 'Oxford Shirt')).toBe('Oxford Shirt');
  });

  it('formats prices with Persian digits and تومان for fa-IR', () => {
    expect(formatPrice(1490000, 'fa-IR')).toMatch(/تومان$/);
    expect(formatPrice(1490000, 'fa-IR')).toMatch(/[۰-۹]/); // contains Persian digits
    expect(formatPrice(1490000, 'en')).toBe('1,490,000 Toman');
  });

  it('groups thousands in both locales', () => {
    expect(formatNumber(1490000, 'en')).toBe('1,490,000');
    expect(formatNumber(0, 'en')).toBe('0');
  });

  it('renders Jalali calendar dates for Persian', () => {
    const iso = '2026-03-21T00:00:00.000Z'; // 1405/01/01 (Nowruz)
    const fa = formatDate(iso, 'fa-IR');
    const en = formatDate(iso, 'en');
    expect(fa).toContain('۱۴۰۵');
    expect(en).toContain('2026');
    expect(fa).not.toBe(en);
  });

  it('returns a dash for invalid dates instead of throwing', () => {
    expect(formatDate('not-a-date', 'en')).toBe('—');
  });

  it('formats ratings with one decimal', () => {
    expect(formatRating(4.5, 'en')).toBe('4.5');
    expect(formatRating(4.5, 'fa-IR')).toMatch(/[۰-۹]/);
  });

  it('computes whole days since a timestamp', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(daysSince(threeDaysAgo)).toBe(3);
    expect(daysSince(new Date())).toBe(0);
  });
});
