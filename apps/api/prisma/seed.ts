/**
 * Demo catalog seed for MehrWearingShopping.
 *
 * - Idempotent: safe to run multiple times (everything upserts by slug/code).
 * - Creates bilingual categories, brands, ~28 products with variants/specs,
 *   an admin, demo customers, approved reviews and active coupons.
 * - Also generates offline-safe SVG placeholder imagery into
 *   apps/web/public/images (committed to git so Docker/CI builds need no
 *   image pipeline).
 *
 * Run: bun run db:seed   (from the repository root)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type SeedVariant = {
  size?: string;
  color?: string;
  colorEn?: string;
  hex?: string;
  stock: number;
  priceToman?: number;
};

type SeedProduct = {
  slug: string;
  category: string;
  brand: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  priceToman: number;
  compareAtPriceToman?: number;
  isFeatured?: boolean;
  weightGram?: number;
  variants: SeedVariant[];
  specs?: [string, string, string, string][];
};

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const hueFor = (input: string): number => {
  const digest = createHash('sha256').update(input).digest();
  return 10 + (digest[0] % 60) * 5 + (digest[1] % 10);
};

/** Abstract, on-brand SVG placeholder — deterministic per slug. */
function placeholderSvg(titleFa: string, titleEn: string, seed: string): string {
  const h1 = hueFor(seed);
  const h2 = (h1 + 28) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${xmlEscape(titleEn)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h1},42%,90%)"/>
      <stop offset="1" stop-color="hsl(${h2},38%,74%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="640" cy="150" r="150" fill="#ffffff" opacity="0.28"/>
  <rect x="40" y="520" width="240" height="240" rx="28" fill="#ffffff" opacity="0.18"/>
  <rect x="560" y="560" width="180" height="180" rx="90" fill="#111827" opacity="0.07"/>
  <text x="400" y="368" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="46" font-weight="700" fill="#111827" direction="rtl">${xmlEscape(titleFa)}</text>
  <text x="400" y="424" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#374151">${xmlEscape(titleEn)}</text>
  <text x="400" y="748" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" letter-spacing="7" fill="#6b7280">MEHRWEARING</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Catalog data
// ---------------------------------------------------------------------------

const categories = [
  { slug: 'tshirts', nameFa: 'تی‌شرت مردانه', nameEn: "Men's T-Shirts" },
  { slug: 'shirts', nameFa: 'پیراهن مردانه', nameEn: "Men's Shirts" },
  { slug: 'jeans', nameFa: 'شلوار جین', nameEn: 'Jeans' },
  { slug: 'chinos', nameFa: 'شلوار کتان و پارچه‌ای', nameEn: 'Chinos & Trousers' },
  { slug: 'jackets', nameFa: 'کاپشن و پالتو', nameEn: 'Jackets & Coats' },
  { slug: 'knitwear', nameFa: 'بافت مردانه', nameEn: 'Knitwear' },
  { slug: 'suits', nameFa: 'کت و شلوار', nameEn: 'Suits & Blazers' },
  { slug: 'sneakers', nameFa: 'کتانی اسپرت', nameEn: 'Sneakers' },
  { slug: 'shoes', nameFa: 'کفش رسمی', nameEn: 'Formal Shoes' },
  { slug: 'accessories', nameFa: 'اکسسوری مردانه', nameEn: 'Accessories' },
];

const brands = [
  { slug: 'mehrwear', nameFa: 'مهرویر', nameEn: 'MehrWear', country: 'IR' },
  { slug: 'denim-lab', nameFa: 'دنیم‌لب', nameEn: 'Denim Lab', country: 'TR' },
  { slug: 'caspian-cotton', nameFa: 'کاسپین کاتن', nameEn: 'Caspian Cotton', country: 'IR' },
  { slug: 'northline', nameFa: 'نورث‌لاین', nameEn: 'Northline', country: 'DE' },
  { slug: 'classic-360', nameFa: 'کلاسیک ۳۶۰', nameEn: 'Classic 360', country: 'IT' },
];

const sizes = (...values: string[]): string[] => values;

const clothing = (
  stock: number,
  colorPairs: [string, string, string][],
  sizeList: string[] = sizes('S', 'M', 'L', 'XL'),
): SeedVariant[] =>
  colorPairs.flatMap(([color, colorEn, hex]) =>
    sizeList.map((size) => ({ size, color, colorEn, hex, stock })),
  );

const products: SeedProduct[] = [
  // --- T-Shirts -----------------------------------------------------------
  {
    slug: 'classic-crew-tshirt',
    category: 'tshirts',
    brand: 'mehrwear',
    nameFa: 'تی‌شرت کلاسیک یقه گرد',
    nameEn: 'Classic Crew Neck Tee',
    descFa:
      'تی‌شرت روزمره از نخ پنبه‌ای ۲۴۰ گرمی با دوخت دوبل؛ سبک، هواخور و بعد از شست‌وشو شکل خود را نگه می‌دارد.',
    descEn:
      'Everyday tee in 240 gsm combed cotton with double stitching. Holds its shape wash after wash.',
    priceToman: 489000,
    compareAtPriceToman: 620000,
    isFeatured: true,
    weightGram: 240,
    variants: clothing(32, [
      ['مشکی', 'Black', '#1f2937'],
      ['سرمه‌ای', 'Navy', '#1e3a8a'],
    ]),
  },
  {
    slug: 'premium-pima-tshirt',
    category: 'tshirts',
    brand: 'caspian-cotton',
    nameFa: 'تی‌شرت پیما کتان',
    nameEn: 'Premium Pima Cotton Tee',
    descFa: 'پنبه پیمای صادراتی با بافت لطیف و درخشش طبیعی؛ انتخاب اول برای استایل مینیمال.',
    descEn:
      'Export-grade Pima cotton with a soft hand-feel and natural sheen — a minimal-wear staple.',
    priceToman: 720000,
    weightGram: 220,
    variants: clothing(24, [
      ['کرم', 'Cream', '#f5f0e6'],
      ['طوسی', 'Gray', '#94a3b8'],
    ]),
  },
  {
    slug: 'urban-graphic-tshirt',
    category: 'tshirts',
    brand: 'denim-lab',
    nameFa: 'تی‌شرت گرافیک اوربن',
    nameEn: 'Urban Graphic Tee',
    descFa: 'طرح گرافیکی چاپ‌سیلک روی جنس هپر نرم؛ برای استایل خیابانی روزمره.',
    descEn: 'Screen-printed graphic on soft heir fabric for an effortless street look.',
    priceToman: 545000,
    compareAtPriceToman: 690000,
    variants: clothing(18, [
      ['مشکی', 'Black', '#111827'],
      ['سبز زیتونی', 'Olive', '#4d7c0f'],
    ]),
  },

  // --- Shirts -------------------------------------------------------------
  {
    slug: 'oxford-shirt',
    category: 'shirts',
    brand: 'caspian-cotton',
    nameFa: 'پیراهن آکسفورد مردانه',
    nameEn: "Men's Oxford Shirt",
    descFa: 'پیراهن آکسفورد با یقه کلاسیک و پارچه تنفس‌پذیر؛ مناسب محیط کار و دورهمی‌های رسمی.',
    descEn:
      'Breathable Oxford weave with a classic collar — equally right at the office or at dinner.',
    priceToman: 1180000,
    isFeatured: true,
    weightGram: 320,
    variants: clothing(20, [
      ['آبی آسمانی', 'Sky Blue', '#7dd3fc'],
      ['سفید', 'White', '#f8fafc'],
    ]),
  },
  {
    slug: 'summer-linen-shirt',
    category: 'shirts',
    brand: 'mehrwear',
    nameFa: 'پیراهن لینن تابستانی',
    nameEn: 'Summer Linen Shirt',
    descFa: 'لینن خالص خنک با برش ریلکس؛ پارچه‌ای که در گرمای تهران همراه شماست.',
    descEn: 'Pure cool-wearing linen with a relaxed cut — built for hot city days.',
    priceToman: 1350000,
    weightGram: 260,
    variants: clothing(16, [
      ['شنی', 'Beige', '#d6c6a8'],
      ['سرمه‌ای', 'Navy', '#1e3a8a'],
    ]),
  },
  {
    slug: 'checkered-flannel-shirt',
    category: 'shirts',
    brand: 'northline',
    nameFa: 'پیراهن چهارخانه نخی',
    nameEn: 'Checkered Flannel Shirt',
    descFa: 'پارچه نخی نرم چهارخانه با دکمه چوبی؛ لایه دوم عالی برای روزهای سرد.',
    descEn: 'Soft brushed flannel check with wooden buttons — a perfect mid-layer.',
    priceToman: 990000,
    compareAtPriceToman: 1290000,
    weightGram: 380,
    variants: clothing(14, [
      ['زرشکی', 'Burgundy', '#7f1d1d'],
      ['زیتونی', 'Olive', '#4d7c0f'],
    ]),
  },

  // --- Jeans --------------------------------------------------------------
  {
    slug: 'slim-fit-jeans',
    category: 'jeans',
    brand: 'denim-lab',
    nameFa: 'شلوار جین اسلیم فیت',
    nameEn: 'Slim Fit Jeans',
    descFa: 'جین کشدار ۱۲ اونس با برش اسلیم و فرم شیک؛ ترکیب راحتی و دوام.',
    descEn: '12 oz stretch denim in a sharp slim cut — comfort that still looks tailored.',
    priceToman: 1490000,
    isFeatured: true,
    weightGram: 720,
    variants: clothing(26, [
      ['سرمه‌ای تیره', 'Dark Indigo', '#1e293b'],
      ['مشکی', 'Black', '#111827'],
    ]),
  },
  {
    slug: 'straight-jeans',
    category: 'jeans',
    brand: 'denim-lab',
    nameFa: 'شلوار جین استریت',
    nameEn: 'Straight Cut Jeans',
    descFa: 'کلاسیک همیشگی: فاق متوسط و پایه استریت؛ با هر کفشی ست می‌شود.',
    descEn: 'The forever classic: mid rise and a straight leg that pairs with anything.',
    priceToman: 1390000,
    weightGram: 760,
    variants: clothing(22, [
      ['آبی متوسط', 'Mid Blue', '#3b82f6'],
      ['سرمه‌ای تیره', 'Dark Indigo', '#1e293b'],
    ]),
  },
  {
    slug: 'tapered-jeans',
    category: 'jeans',
    brand: 'denim-lab',
    nameFa: 'شلوار جین تیپرد',
    nameEn: 'Tapered Jeans',
    descFa: 'گشاد در ران و جمع در مچ پا؛ ایده‌آل برای کتانی‌های اسپرت.',
    descEn: 'Roomy at the thigh and tapered at the ankle — made for sneakers.',
    priceToman: 1590000,
    compareAtPriceToman: 1890000,
    weightGram: 740,
    variants: clothing(12, [
      ['آبی روشن', 'Light Blue', '#93c5fd'],
      ['مشکی', 'Black', '#111827'],
    ]),
  },

  // --- Chinos -------------------------------------------------------------
  {
    slug: 'stretch-chinos',
    category: 'chinos',
    brand: 'mehrwear',
    nameFa: 'شلوار کتان کشدار',
    nameEn: 'Stretch Chinos',
    descFa: 'کتان کشدار با رویه مات؛ نیمه‌رسمی که از صبح تا شب راحت می‌ماند.',
    descEn: 'Matte stretch twill — a smart-casual pair that stays comfortable all day.',
    priceToman: 1090000,
    weightGram: 540,
    variants: clothing(20, [
      ['کرم', 'Cream', '#f5f0e6'],
      ['زیتونی', 'Olive', '#4d7c0f'],
      ['سرمه‌ای', 'Navy', '#1e3a8a'],
    ]),
  },
  {
    slug: 'classic-tailored-trousers',
    category: 'chinos',
    brand: 'classic-360',
    nameFa: 'شلوار پارچه‌ای کلاسیک',
    nameEn: 'Classic Tailored Trousers',
    descFa: 'شلوار پارچه‌ای با اتوکشی دائمی و پایه کمی گشاد؛ مناسب ست‌های رسمی.',
    descEn: 'Wrinkle-resistant tailored trousers with a gentle break for sharp formal sets.',
    priceToman: 1290000,
    weightGram: 580,
    variants: clothing(15, [
      ['مشکی', 'Black', '#111827'],
      ['طوسی', 'Gray', '#6b7280'],
    ]),
  },

  // --- Jackets ------------------------------------------------------------
  {
    slug: 'classic-denim-jacket',
    category: 'jackets',
    brand: 'denim-lab',
    nameFa: 'کاپشن جین کلاسیک',
    nameEn: 'Classic Denim Jacket',
    descFa: 'کاپشن جین ریجید با شست‌وشوی سنگی؛ لایه‌ای ماندگار برای فصل‌های میانی.',
    descEn: 'Rigid stonewashed denim jacket — a durable layer for in-between seasons.',
    priceToman: 2450000,
    isFeatured: true,
    weightGram: 1100,
    variants: clothing(14, [
      ['آبی متوسط', 'Mid Blue', '#3b82f6'],
      ['سرمه‌ای تیره', 'Dark Indigo', '#1e293b'],
    ]),
  },
  {
    slug: 'bomber-jacket',
    category: 'jackets',
    brand: 'northline',
    nameFa: 'کاپشن بامبر',
    nameEn: 'Bomber Jacket',
    descFa: 'بامبر سبک با آستر بادگیر و سجاف کشبافت؛ استایل شهری بدون زحمت.',
    descEn: 'Lightweight bomber with a windproof lining and ribbed cuffs.',
    priceToman: 2890000,
    weightGram: 860,
    variants: clothing(11, [
      ['مشکی', 'Black', '#111827'],
      ['زیتونی', 'Olive', '#4d7c0f'],
    ]),
  },
  {
    slug: 'wool-overcoat',
    category: 'jackets',
    brand: 'classic-360',
    nameFa: 'پالتو پشمی',
    nameEn: 'Wool Overcoat',
    descFa: 'پالتو پشمی دوبل با یقه شالی؛ گرم، شیک و بی‌زمان برای زمستان.',
    descEn: 'Double-faced wool overcoat with a shawl collar — timeless winter warmth.',
    priceToman: 5900000,
    compareAtPriceToman: 6900000,
    weightGram: 1800,
    variants: clothing(
      9,
      [
        ['طوسی', 'Gray', '#6b7280'],
        ['شتری', 'Camel', '#b08968'],
      ],
      sizes('M', 'L', 'XL'),
    ),
  },

  // --- Knitwear -----------------------------------------------------------
  {
    slug: 'crewneck-sweater',
    category: 'knitwear',
    brand: 'mehrwear',
    nameFa: 'بافت یقه گرد',
    nameEn: 'Crewneck Sweater',
    descFa: 'بافت نرم با نخ مرینو؛ گرم بدون حجم اضافه.',
    descEn: 'Soft merino-blend knit — warmth without the bulk.',
    priceToman: 1290000,
    weightGram: 480,
    variants: clothing(17, [
      ['سرمه‌ای', 'Navy', '#1e3a8a'],
      ['کرم', 'Cream', '#f5f0e6'],
      ['زرشکی', 'Burgundy', '#7f1d1d'],
    ]),
  },
  {
    slug: 'half-zip-knit',
    category: 'knitwear',
    brand: 'northline',
    nameFa: 'بافت نیم‌زیپ',
    nameEn: 'Half-Zip Knit',
    descFa: 'بافت نیم‌زیپ با یقه ایستاده؛ لایه‌ای هوشمند برای سفر و کار.',
    descEn: 'Stand-collar half-zip knit — a smart layer for travel and work.',
    priceToman: 1490000,
    isFeatured: true,
    weightGram: 520,
    variants: clothing(13, [
      ['طوسی', 'Gray', '#6b7280'],
      ['زیتونی', 'Olive', '#4d7c0f'],
    ]),
  },
  {
    slug: 'mens-cardigan',
    category: 'knitwear',
    brand: 'caspian-cotton',
    nameFa: 'کاردیگان مردانه',
    nameEn: "Men's Cardigan",
    descFa: 'کاردیگان دکمه‌دار با بافت ظریف؛ هم‌نشین خوب پیراهن و تی‌شرت.',
    descEn: 'A fine-gauge button-up that sits equally well over tees and shirts.',
    priceToman: 1390000,
    weightGram: 540,
    variants: clothing(10, [
      ['کرم', 'Cream', '#f5f0e6'],
      ['سرمه‌ای', 'Navy', '#1e3a8a'],
    ]),
  },

  // --- Suits --------------------------------------------------------------
  {
    slug: 'slim-fit-suit',
    category: 'suits',
    brand: 'classic-360',
    nameFa: 'کت و شلوار اسلیم',
    nameEn: 'Slim Fit Suit',
    descFa: 'کت و شلوار دو تکه با فرم اسلیم و پارچه ضدچروک؛ آماده مراسم و اداره.',
    descEn: 'Two-piece slim suit in wrinkle-resistant cloth — ceremony-ready out of the bag.',
    priceToman: 7900000,
    isFeatured: true,
    weightGram: 2400,
    variants: clothing(
      8,
      [
        ['سرمه‌ای', 'Navy', '#1e3a8a'],
        ['ذغالی', 'Charcoal', '#374151'],
      ],
      sizes('46', '48', '50', '52'),
    ),
    specs: [['جنس پارچه', 'Fabric', 'پشم ۷۰٪ و پلی‌استر ۳۰٪', '70% wool / 30% polyester']],
  },
  {
    slug: 'linen-blazer',
    category: 'suits',
    brand: 'mehrwear',
    nameFa: 'بلیزر لینن',
    nameEn: 'Linen Blazer',
    descFa: 'بلیزر تک‌دکمه از لینن سبک؛ نجیبانه و خنک برای تابستان.',
    descEn: 'Single-breasted linen blazer — refined and cool for summer.',
    priceToman: 3450000,
    weightGram: 900,
    variants: clothing(
      9,
      [
        ['شنی', 'Beige', '#d6c6a8'],
        ['آبی روشن', 'Light Blue', '#93c5fd'],
      ],
      sizes('46', '48', '50'),
    ),
  },

  // --- Sneakers -----------------------------------------------------------
  {
    slug: 'court-sneakers',
    category: 'sneakers',
    brand: 'northline',
    nameFa: 'کتانی کورت',
    nameEn: 'Court Sneakers',
    descFa: 'کتانی چرمی سفید با زیره لاستیکی بی‌صدا؛ ست اصل استایل روزمره.',
    descEn: 'White leather court sneakers on a quiet rubber sole — a daily-driver classic.',
    priceToman: 2190000,
    isFeatured: true,
    weightGram: 820,
    variants: [
      { size: '40', stock: 12, color: 'سفید', colorEn: 'White', hex: '#f8fafc' },
      { size: '41', stock: 15, color: 'سفید', colorEn: 'White', hex: '#f8fafc' },
      { size: '42', stock: 10, color: 'سفید', colorEn: 'White', hex: '#f8fafc' },
      { size: '43', stock: 8, color: 'سفید', colorEn: 'White', hex: '#f8fafc' },
      { size: '44', stock: 6, color: 'سفید', colorEn: 'White', hex: '#f8fafc' },
    ],
  },
  {
    slug: 'running-sneakers',
    category: 'sneakers',
    brand: 'northline',
    nameFa: 'کتانی دویدن',
    nameEn: 'Running Sneakers',
    descFa: 'کفش دو با کفه ضربه‌گیر و رویه مش تنفس‌پذیر؛ سبک برای دویدن شهری.',
    descEn: 'Cushioned runners with a breathable mesh upper — light on city miles.',
    priceToman: 2690000,
    compareAtPriceToman: 3100000,
    weightGram: 640,
    variants: [
      { size: '40', stock: 7, color: 'مشکی', colorEn: 'Black', hex: '#111827' },
      { size: '41', stock: 9, color: 'مشکی', colorEn: 'Black', hex: '#111827' },
      { size: '42', stock: 11, color: 'مشکی', colorEn: 'Black', hex: '#111827' },
      { size: '43', stock: 5, color: 'خاکستری', colorEn: 'Gray', hex: '#94a3b8' },
      { size: '44', stock: 4, color: 'خاکستری', colorEn: 'Gray', hex: '#94a3b8' },
    ],
  },
  {
    slug: 'canvas-sneakers',
    category: 'sneakers',
    brand: 'mehrwear',
    nameFa: 'کتانی کنفی',
    nameEn: 'Canvas Sneakers',
    descFa: 'کتانی کنفی سبک با زیره لاستیکی؛ همراه همیشگی آخر هفته‌ها.',
    descEn: 'Featherlight canvas sneakers on a rubber sole — your weekend constant.',
    priceToman: 1290000,
    weightGram: 520,
    variants: [
      { size: '40', stock: 14, color: 'کرم', colorEn: 'Cream', hex: '#f5f0e6' },
      { size: '41', stock: 16, color: 'کرم', colorEn: 'Cream', hex: '#f5f0e6' },
      { size: '42', stock: 12, color: 'سرمه‌ای', colorEn: 'Navy', hex: '#1e3a8a' },
      { size: '43', stock: 9, color: 'سرمه‌ای', colorEn: 'Navy', hex: '#1e3a8a' },
      { size: '44', stock: 0, color: 'سرمه‌ای', colorEn: 'Navy', hex: '#1e3a8a' },
    ],
  },

  // --- Formal shoes -------------------------------------------------------
  {
    slug: 'leather-oxford',
    category: 'shoes',
    brand: 'classic-360',
    nameFa: 'کفش آکسفورد چرمی',
    nameEn: 'Leather Oxford Shoes',
    descFa: 'آکسفورد دست‌دوز از چرم گاوی؛ انتخاب رسمی جلسات مهم.',
    descEn: 'Hand-stitched calf-leather Oxfords — for the meetings that matter.',
    priceToman: 3890000,
    weightGram: 1100,
    variants: [
      { size: '40', stock: 5, color: 'مشکی', colorEn: 'Black', hex: '#111827' },
      { size: '41', stock: 6, color: 'مشکی', colorEn: 'Black', hex: '#111827' },
      { size: '42', stock: 6, color: 'قهوه‌ای', colorEn: 'Brown', hex: '#78350f' },
      { size: '43', stock: 4, color: 'قهوه‌ای', colorEn: 'Brown', hex: '#78350f' },
      { size: '44', stock: 3, color: 'قهوه‌ای', colorEn: 'Brown', hex: '#78350f' },
    ],
  },
  {
    slug: 'suede-loafers',
    category: 'shoes',
    brand: 'classic-360',
    nameFa: 'کفش لوفر جیر',
    nameEn: 'Suede Loafers',
    descFa: 'لوفر جیر نرم بدون بند؛ ترکیب راحتی و ظرافت.',
    descEn: 'Soft slip-on suede loafers — ease with polish.',
    priceToman: 2950000,
    compareAtPriceToman: 3450000,
    weightGram: 880,
    variants: [
      { size: '40', stock: 6, color: 'شنی', colorEn: 'Beige', hex: '#d6c6a8' },
      { size: '41', stock: 7, color: 'شنی', colorEn: 'Beige', hex: '#d6c6a8' },
      { size: '42', stock: 7, color: 'سرمه‌ای', colorEn: 'Navy', hex: '#1e3a8a' },
      { size: '43', stock: 5, color: 'سرمه‌ای', colorEn: 'Navy', hex: '#1e3a8a' },
    ],
  },

  // --- Accessories --------------------------------------------------------
  {
    slug: 'genuine-leather-belt',
    category: 'accessories',
    brand: 'mehrwear',
    nameFa: 'کمربند چرم طبیعی',
    nameEn: 'Genuine Leather Belt',
    descFa: 'کمربند چرم گاوی طبیعی با قفل فلزی؛ ساده و ماندگار.',
    descEn: 'Full-grain cowhide belt with a solid metal buckle.',
    priceToman: 690000,
    weightGram: 180,
    variants: [
      { color: 'قهوه‌ای', colorEn: 'Brown', hex: '#78350f', stock: 40 },
      { color: 'مشکی', colorEn: 'Black', hex: '#111827', stock: 35 },
    ],
  },
  {
    slug: 'classic-wristwatch',
    category: 'accessories',
    brand: 'classic-360',
    nameFa: 'ساعت مچی کلاسیک',
    nameEn: 'Classic Wristwatch',
    descFa: 'ساعت با صفحه مینیمال، بند چرم و موتور کوارتز ژاپنی؛ بدون تاریخ اضافه، فقط زمان.',
    descEn: 'Minimal dial, leather strap, Japanese quartz movement — just the time.',
    priceToman: 4200000,
    isFeatured: true,
    weightGram: 120,
    variants: [{ color: 'بند قهوه‌ای', colorEn: 'Brown strap', hex: '#78350f', stock: 12 }],
  },
  {
    slug: 'mens-baseball-cap',
    category: 'accessories',
    brand: 'denim-lab',
    nameFa: 'کلاه کپ مردانه',
    nameEn: "Men's Baseball Cap",
    descFa: 'کپ شش‌تکه با قابلیت تنظیم سایز و تهویه پشت سر.',
    descEn: 'Six-panel cap with an adjustable strap and rear venting.',
    priceToman: 420000,
    weightGram: 90,
    variants: [
      { color: 'مشکی', colorEn: 'Black', hex: '#111827', stock: 50 },
      { color: 'کرم', colorEn: 'Cream', hex: '#f5f0e6', stock: 44 },
    ],
  },
  {
    slug: 'aviator-sunglasses',
    category: 'accessories',
    brand: 'northline',
    nameFa: 'عینک آفتابی اویاتور',
    nameEn: 'Aviator Sunglasses',
    descFa: 'اویاتور کلاسیک با عدسی پلاریزه UV400 و فریم فلزی سبک.',
    descEn: 'Classic aviators with polarized UV400 lenses and a featherlight frame.',
    priceToman: 1150000,
    compareAtPriceToman: 1390000,
    weightGram: 40,
    variants: [{ color: 'قاب طلایی', colorEn: 'Gold frame', hex: '#b45309', stock: 22 }],
  },
];

const coupons = [
  {
    code: 'MEHR10',
    type: 'PERCENT' as const,
    value: 10,
    maxDiscountToman: 300000,
    minOrderToman: 500000,
    descriptionFa: '۱۰٪ تخفیف تا سقف ۳۰۰ هزار تومان',
    descriptionEn: '10% off, up to 300,000 Toman',
  },
  {
    code: 'FREESHIP',
    type: 'SHIPPING' as const,
    value: 0,
    minOrderToman: 300000,
    descriptionFa: 'ارسال رایگان برای سفارش‌های بالای ۳۰۰ هزار تومان',
    descriptionEn: 'Free shipping on orders over 300,000 Toman',
  },
  {
    code: 'WELCOME50',
    type: 'FIXED' as const,
    value: 50000,
    minOrderToman: 400000,
    usageLimit: 1000,
    descriptionFa: '۵۰ هزار تومان تخفیف خوش‌آمدگویی',
    descriptionEn: '50,000 Toman welcome discount',
  },
];

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin123';

const users = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@mehrwearing.ir',
    fullName: 'مدیر فروشگاه',
    role: 'ADMIN' as const,
    password: adminPassword,
    phone: '09120000001',
  },
  {
    email: 'demo@mehrwearing.ir',
    fullName: 'کاربر نمونه',
    role: 'CUSTOMER' as const,
    password: demoPassword,
    phone: '09120000002',
  },
  {
    email: 'sara@example.com',
    fullName: 'سارا محمدی',
    role: 'CUSTOMER' as const,
    password: demoPassword,
    phone: '09120000003',
  },
  {
    email: 'ali@example.com',
    fullName: 'علی رضایی',
    role: 'CUSTOMER' as const,
    password: demoPassword,
    phone: '09120000004',
  },
  {
    email: 'reza@example.com',
    fullName: 'رضا کریمی',
    role: 'CUSTOMER' as const,
    password: demoPassword,
    phone: '09120000005',
  },
];

type SeedReview = { product: string; author: string; rating: number; title: string; body: string };

const reviews: SeedReview[] = [
  {
    product: 'classic-crew-tshirt',
    author: 'ali@example.com',
    rating: 5,
    title: 'کیفیت عالی',
    body: 'پارچه‌اش ضخیم و لطیفه، بعد از چند بار شست‌وشو رنگش عوض نشد.',
  },
  {
    product: 'classic-crew-tshirt',
    author: 'reza@example.com',
    rating: 4,
    title: 'سایز بندی خوب',
    body: 'سایز M دقیقاً اندازه‌ام بود. پیشنهاد می‌کنم.',
  },
  {
    product: 'oxford-shirt',
    author: 'sara@example.com',
    rating: 5,
    title: 'عالی برای محل کار',
    body: 'پیراهن شیکیه، همسرم راضیه. اتو هم کم می‌خواد.',
  },
  {
    product: 'slim-fit-jeans',
    author: 'ali@example.com',
    rating: 5,
    title: 'جین واقعاً باکیفیت',
    body: 'فرم اسلیم خیلی تمیزه و کش‌دار بودنش راحتیش رو دو چندان کرده.',
  },
  {
    product: 'slim-fit-jeans',
    author: 'reza@example.com',
    rating: 4,
    title: 'خوب ولی...',
    body: 'کمرش یکم بالاست، وگرنش عالیه.',
  },
  {
    product: 'straight-jeans',
    author: 'sara@example.com',
    rating: 5,
    title: 'کلاسیک و بی‌نقص',
    body: 'رنگ سرمه‌ایش دقیقاً مثل عکسه.',
  },
  {
    product: 'classic-denim-jacket',
    author: 'reza@example.com',
    rating: 5,
    title: 'پیشنهاد ویژه',
    body: 'سنگ‌شورش حرفه‌ایه، لایه‌های خوبی روی تی‌شرت می‌خوره.',
  },
  {
    product: 'court-sneakers',
    author: 'ali@example.com',
    rating: 5,
    title: 'راحت و شیک',
    body: 'تمام روز پام تو این کفش بود و خسته نشدم.',
  },
  {
    product: 'court-sneakers',
    author: 'sara@example.com',
    rating: 4,
    title: 'سایز',
    body: 'یک سایز بزرگ‌تر بگیرید، من ۴۳ گرفتم عالی بود.',
  },
  {
    product: 'crewneck-sweater',
    author: 'reza@example.com',
    rating: 5,
    title: 'گرم و سبک',
    body: 'مرینوش واقعاً گرمه بدون اینکه حجم بده.',
  },
  {
    product: 'summer-linen-shirt',
    author: 'sara@example.com',
    rating: 4,
    title: 'خنک و خوشگل',
    body: 'تو گرمای تهران عالیه، فقط موقع اتو کمی اذیت می‌کنه.',
  },
  {
    product: 'leather-oxford',
    author: 'ali@example.com',
    rating: 5,
    title: 'لاکچری',
    body: 'چرم طبیعیشه و کاملاً مشخصه. جلسات مهم ازش استفاده می‌کنم.',
  },
  {
    product: 'stretch-chinos',
    author: 'reza@example.com',
    rating: 5,
    title: 'ست با همه‌چیز',
    body: 'با کفش رسمی و کتانی هر دو قشنگه.',
  },
  {
    product: 'classic-wristwatch',
    author: 'sara@example.com',
    rating: 5,
    title: 'هدیه عالی',
    body: 'برای همسرم خریدم، بسته‌بندی شیک و کیفیت بالا.',
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function resolveImagesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '../web/public/images/products'),
    path.resolve(process.cwd(), 'apps/web/public/images/products'),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.dirname(path.dirname(candidate)))) {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    }
  }
  mkdirSync(candidates[0], { recursive: true });
  return candidates[0];
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const imagesDir = resolveImagesDir();

  console.info(`Seeding database ${process.env.DATABASE_URL ?? '(default)'} …`);
  console.info(`Writing placeholder imagery to ${imagesDir}`);

  // --- categories --------------------------------------------------------
  for (const [index, category] of categories.entries()) {
    const imageUrl = `/images/products/cat-${category.slug}.svg`;
    writeFileSync(
      path.join(imagesDir, `cat-${category.slug}.svg`),
      placeholderSvg(category.nameFa, category.nameEn, `category-${category.slug}`),
    );
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        nameFa: category.nameFa,
        nameEn: category.nameEn,
        imageUrl,
        position: index,
      },
      update: { nameFa: category.nameFa, nameEn: category.nameEn, imageUrl, position: index },
    });
  }

  // --- brands ------------------------------------------------------------
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: {
        slug: brand.slug,
        nameFa: brand.nameFa,
        nameEn: brand.nameEn,
        country: brand.country,
      },
      update: { nameFa: brand.nameFa, nameEn: brand.nameEn, country: brand.country },
    });
  }

  // --- users -------------------------------------------------------------
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        passwordHash,
        locale: 'fa-IR',
      },
      update: { fullName: user.fullName, role: user.role, passwordHash },
    });
  }

  // --- products ----------------------------------------------------------
  const defaultSpecs: Record<string, [string, string, string, string][]> = {
    shirts: [
      ['جنس پارچه', 'Fabric', '۱۰۰٪ پنبه', '100% cotton'],
      ['نگهداری', 'Care', 'شست‌وشوی ماشینی ۳۰ درجه', 'Machine wash 30°C'],
    ],
    jeans: [
      ['جنس پارچه', 'Fabric', 'جین کشدار ۱۲ اونس', '12 oz stretch denim'],
      ['نگهداری', 'Care', 'شست‌وشو با رنگ تیره، خشک‌کن ممنوع', 'Wash dark colours, no tumble dry'],
    ],
    sneakers: [
      ['زیره', 'Outsole', 'لاستیک ضدلغز', 'Non-slip rubber'],
      ['نگهداری', 'Care', 'دست‌شویی با برس نرم', 'Hand wash with a soft brush'],
    ],
    shoes: [
      ['جنس رویه', 'Upper', 'چرم گاوی طبیعی', 'Full-grain cowhide'],
      ['نگهداری', 'Care', 'واکس و برس چرم', 'Leather cream and brush'],
    ],
  };

  for (const product of products) {
    const imageUrl = `/images/products/${product.slug}.svg`;
    writeFileSync(
      path.join(imagesDir, `${product.slug}.svg`),
      placeholderSvg(product.nameFa, product.nameEn, product.slug),
    );

    const searchText = [
      product.nameFa,
      product.nameEn,
      product.slug,
      product.category,
      product.brand,
    ]
      .join(' ')
      .toLowerCase();

    const created = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        categoryId: (await prisma.category.findUniqueOrThrow({ where: { slug: product.category } }))
          .id,
        brandId: (await prisma.brand.findUniqueOrThrow({ where: { slug: product.brand } })).id,
        nameFa: product.nameFa,
        nameEn: product.nameEn,
        descriptionFa: product.descFa,
        descriptionEn: product.descEn,
        searchText,
        priceToman: product.priceToman,
        compareAtPriceToman: product.compareAtPriceToman ?? null,
        isFeatured: product.isFeatured ?? false,
        weightGram: product.weightGram ?? null,
        images: {
          create: [{ url: imageUrl, altFa: product.nameFa, altEn: product.nameEn, position: 0 }],
        },
      },
      update: {
        nameFa: product.nameFa,
        nameEn: product.nameEn,
        descriptionFa: product.descFa,
        descriptionEn: product.descEn,
        searchText,
        priceToman: product.priceToman,
        compareAtPriceToman: product.compareAtPriceToman ?? null,
        isFeatured: product.isFeatured ?? false,
        weightGram: product.weightGram ?? null,
      },
    });

    // variants (idempotent by SKU)
    const variantCount = await prisma.productVariant.count({ where: { productId: created.id } });
    if (variantCount === 0) {
      await prisma.productVariant.createMany({
        data: product.variants.map((variant, index) => ({
          productId: created.id,
          size: variant.size ?? null,
          color: variant.color ?? null,
          colorEn: variant.colorEn ?? null,
          colorHex: variant.hex ?? null,
          sku: `${product.slug.slice(0, 10).toUpperCase()}-${index + 1}`,
          priceToman: variant.priceToman ?? null,
          stock: variant.stock,
        })),
      });
    }

    // images (only when missing)
    const imageCount = await prisma.productImage.count({ where: { productId: created.id } });
    if (imageCount === 0) {
      await prisma.productImage.create({
        data: {
          productId: created.id,
          url: imageUrl,
          altFa: product.nameFa,
          altEn: product.nameEn,
          position: 0,
        },
      });
    }

    // specs
    const specCount = await prisma.productSpec.count({ where: { productId: created.id } });
    if (specCount === 0) {
      const specs = [...(defaultSpecs[product.category] ?? []), ...(product.specs ?? [])];
      await prisma.productSpec.createMany({
        data: specs.map(([keyFa, keyEn, valueFa, valueEn], index) => ({
          productId: created.id,
          keyFa,
          keyEn,
          valueFa,
          valueEn,
          position: index,
        })),
      });
    }
  }

  // --- coupons -----------------------------------------------------------
  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      create: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscountToman: coupon.maxDiscountToman ?? null,
        minOrderToman: coupon.minOrderToman ?? 0,
        usageLimit: coupon.usageLimit ?? null,
        descriptionFa: coupon.descriptionFa,
        descriptionEn: coupon.descriptionEn,
      },
      update: {
        type: coupon.type,
        value: coupon.value,
        maxDiscountToman: coupon.maxDiscountToman ?? null,
        minOrderToman: coupon.minOrderToman ?? 0,
        isActive: true,
        descriptionFa: coupon.descriptionFa,
        descriptionEn: coupon.descriptionEn,
      },
    });
  }

  // --- reviews -----------------------------------------------------------
  for (const review of reviews) {
    const author = await prisma.user.findUnique({ where: { email: review.author } });
    const product = await prisma.product.findUnique({ where: { slug: review.product } });
    if (!author || !product) continue;
    await prisma.review.upsert({
      where: { productId_userId: { productId: product.id, userId: author.id } },
      create: {
        productId: product.id,
        userId: author.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: 'APPROVED',
      },
      update: { rating: review.rating, title: review.title, body: review.body, status: 'APPROVED' },
    });
  }

  // --- recompute rating aggregates --------------------------------------
  const allProducts = await prisma.product.findMany({ select: { id: true } });
  for (const product of allProducts) {
    const aggregate = await prisma.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        ratingCount: aggregate._count,
      },
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    reviews: await prisma.review.count(),
    coupons: await prisma.coupon.count(),
    users: await prisma.user.count(),
  };

  console.info('✔ Seed complete:', JSON.stringify(counts));
  console.info(`  Admin login:  ${users[0].email} / ${adminPassword}`);
  console.info(`  Demo login:   ${users[1].email} / ${demoPassword}`);

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
