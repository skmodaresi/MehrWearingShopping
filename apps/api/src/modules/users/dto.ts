import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { toEnglishDigits } from '../../common/utils/persian';

const digits = ({ value }: { value: unknown }): string => toEnglishDigits(String(value ?? ''));

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName?: string;

  @ApiPropertyOptional({ example: '09123456789' })
  @IsOptional()
  @Matches(/^09[0-9]{9}$/, { message: 'phone must be a valid Iranian mobile number (09…)' })
  phone?: string;

  @ApiPropertyOptional({ enum: ['fa-IR', 'en'] })
  @IsOptional()
  @IsIn(['fa-IR', 'en'])
  locale?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class AddressDto {
  @ApiPropertyOptional({ example: 'خانه', description: 'Address nickname' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @ApiProperty({ example: 'علی رضایی' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  recipientName: string;

  @ApiProperty({ example: '09123456789' })
  @Matches(/^09[0-9]{9}$/, { message: 'phone must be a valid Iranian mobile number (09…)' })
  phone: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  province: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  city: string;

  @ApiProperty({ example: '1234567890' })
  @Transform(digits)
  @Matches(/^[0-9]{10}$/, { message: 'postalCode must be a 10 digit number' })
  postalCode: string;

  @ApiProperty({ example: 'خیابان ولیعصر، کوچه نور، پلاک ۱۲، واحد ۳' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  addressLine: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
