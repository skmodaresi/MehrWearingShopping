import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const csv = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const bool = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
};

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'bestseller';

export class ProductListQueryDto {
  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Brand slug' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Full-text Persian/English search' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Minimum price in Toman' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in Toman' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Comma separated sizes, e.g. M,L' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  @ApiPropertyOptional({ description: 'Comma separated colors (Persian or English names)' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @ApiPropertyOptional({ description: 'Only products with stock' })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Only discounted products' })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  discount?: boolean;

  @ApiPropertyOptional({ description: 'Only featured products' })
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    enum: ['newest', 'price-asc', 'price-desc', 'rating', 'bestseller'],
    default: 'newest',
  })
  @IsOptional()
  @IsIn(['newest', 'price-asc', 'price-desc', 'rating', 'bestseller'])
  sort?: ProductSort = 'newest';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export class AdminVariantDto {
  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  size?: string;

  @ApiPropertyOptional({ example: 'مشکی' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ example: 'Black' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colorEn?: string;

  @ApiPropertyOptional({ example: '#1f2937' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  colorHex?: string;

  @ApiProperty({ example: 'SHIRT-M-BLK' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  sku: string;

  @ApiPropertyOptional({ description: 'Optional per-variant price override in Toman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceToman?: number;

  @ApiProperty({ default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;
}

export class AdminSpecDto {
  @ApiProperty() @IsString() @MaxLength(60) keyFa: string;
  @ApiProperty() @IsString() @MaxLength(60) keyEn: string;
  @ApiProperty() @IsString() @MaxLength(160) valueFa: string;
  @ApiProperty() @IsString() @MaxLength(160) valueEn: string;
}

export class AdminProductDto {
  @ApiPropertyOptional({ description: 'Category slug (required on create)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Brand slug' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Custom slug; auto-generated from the English name otherwise',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiProperty({ example: 'پیراهن آکسفورد مردانه' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  nameFa: string;

  @ApiProperty({ example: "Men's Oxford Shirt" })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  nameEn: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionFa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionEn?: string;

  @ApiProperty({ description: 'Base price in Toman', example: 1180000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceToman: number;

  @ApiPropertyOptional({ description: 'Crossed-out comparison price in Toman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPriceToman?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'HIDDEN'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'HIDDEN'])
  status?: 'DRAFT' | 'ACTIVE' | 'HIDDEN';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: [AdminVariantDto] })
  @IsOptional()
  @Type(() => AdminVariantDto)
  @IsArray()
  variants?: AdminVariantDto[];

  @ApiPropertyOptional({ type: [AdminSpecDto] })
  @IsOptional()
  @Type(() => AdminSpecDto)
  @IsArray()
  specs?: AdminSpecDto[];
}

export class AdminVariantStockDto {
  @ApiProperty({ description: 'New absolute stock level (creates an ADJUST movement)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;
}

export class AdminCategoryDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) slug: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) nameFa: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) nameEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() position?: number;
}

export class AdminBrandDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) slug: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) nameFa: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) nameEn: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) country?: string;
}
