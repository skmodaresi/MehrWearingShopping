import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product variant id (size/color/SKU)' })
  @IsString()
  variantId: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, description: 'New quantity (1…stock); use DELETE to remove' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;
}
