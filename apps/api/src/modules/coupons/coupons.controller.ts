import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/auth.decorators';
import { CouponsService } from './coupons.service';

class ValidateCouponDto {
  @ApiProperty({ example: 'MEHR10' })
  @IsString()
  @MaxLength(40)
  code: string;

  @ApiProperty({ description: 'Subtotal in Toman the discount would apply to', example: 800000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalToman: number;
}

class AdminCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @MaxLength(40)
  code: string;

  @ApiProperty({ enum: ['PERCENT', 'FIXED', 'SHIPPING'] })
  @IsIn(['PERCENT', 'FIXED', 'SHIPPING'])
  type: 'PERCENT' | 'FIXED' | 'SHIPPING';

  @ApiProperty({ description: 'PERCENT: 1-100, FIXED: Toman, SHIPPING: 0', example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Cap for PERCENT coupons' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscountToman?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderToman?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descriptionFa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descriptionEn?: string;
}

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate')
  @Public()
  @ApiOperation({ summary: 'Preview a coupon against a subtotal (checkout UX)' })
  validate(@Body() dto: ValidateCouponDto) {
    return this.coupons.preview(dto.code, dto.subtotalToman);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get('coupons')
  @ApiOperation({ summary: 'List coupons' })
  list() {
    return this.coupons.list();
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a coupon' })
  create(@Body() dto: AdminCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'Update a coupon' })
  update(@Param('id') id: string, @Body() dto: Partial<AdminCouponDto>) {
    return this.coupons.update(id, dto);
  }
}
