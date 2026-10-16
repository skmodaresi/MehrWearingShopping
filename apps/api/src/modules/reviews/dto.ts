import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  body: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ minLength: 5, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  body?: string;
}

export class ReviewStatusDto {
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
