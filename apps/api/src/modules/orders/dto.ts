import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PlaceOrderDto {
  @ApiProperty({ description: 'Saved address id of the current user' })
  @IsString()
  addressId: string;

  @ApiProperty({ enum: ['STANDARD', 'EXPRESS'], default: 'STANDARD' })
  @IsIn(['STANDARD', 'EXPRESS'])
  shippingMethod: 'STANDARD' | 'EXPRESS';

  @ApiPropertyOptional({ example: 'MEHR10' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Note for the courier' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class OrderStatusDto {
  @ApiProperty({
    enum: ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
  })
  @IsIn(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
}

export class CreatePaymentDto {
  @ApiPropertyOptional({
    enum: ['mock', 'zarinpal'],
    description: 'Defaults to the server configuration',
  })
  @IsOptional()
  @IsIn(['mock', 'zarinpal'])
  provider?: 'mock' | 'zarinpal';
}
