import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'Str0ng!Pass' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'علی رضایی', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName: string;

  @ApiPropertyOptional({ example: '09123456789', pattern: '^09[0-9]{9}$' })
  @IsOptional()
  @Matches(/^09[0-9]{9}$/, { message: 'phone must be a valid Iranian mobile number (09…)' })
  phone?: string;

  @ApiPropertyOptional({ enum: ['fa-IR', 'en'], default: 'fa-IR' })
  @IsOptional()
  @IsIn(['fa-IR', 'en'])
  locale?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token returned by register/login/refresh' })
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
