import { Injectable } from '@nestjs/common';
import { Address } from '../../generated/prisma/client';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddressDto, ChangePasswordDto, UpdateProfileDto } from './dto';
import { toUserDto, UserDto } from '../auth/auth.service';
import bcrypt from 'bcryptjs';

export interface AddressDtoOutput {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  isDefault: boolean;
  createdAt: string;
}

export const toAddressDto = (address: Address): AddressDtoOutput => ({
  id: address.id,
  label: address.label,
  recipientName: address.recipientName,
  phone: address.phone,
  province: address.province,
  city: address.city,
  postalCode: address.postalCode,
  addressLine: address.addressLine,
  isDefault: address.isDefault,
  createdAt: address.createdAt.toISOString(),
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    if (dto.phone) {
      const owner = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (owner && owner.id !== userId) {
        throw ApiException.conflict('PHONE_TAKEN', 'This phone number belongs to another account');
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      },
    });
    return toUserDto(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw ApiException.badRequest('INVALID_PASSWORD', 'Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Password change invalidates every existing session.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  listAddresses(userId: string): Promise<AddressDtoOutput[]> {
    return this.prisma.address
      .findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })
      .then((addresses) => addresses.map(toAddressDto));
  }

  async createAddress(userId: string, dto: AddressDto): Promise<AddressDtoOutput> {
    const count = await this.prisma.address.count({ where: { userId } });
    const address = await this.prisma.address.create({
      data: {
        ...dto,
        label: dto.label ?? dto.city,
        userId,
        // First address always becomes the default.
        isDefault: dto.isDefault ?? count === 0,
      },
    });
    if (address.isDefault) await this.clearOtherDefaults(userId, address.id);
    return toAddressDto(address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: Partial<AddressDto>,
  ): Promise<AddressDtoOutput> {
    await this.assertOwned(userId, addressId);
    const address = await this.prisma.address.update({ where: { id: addressId }, data: dto });
    if (address.isDefault) await this.clearOtherDefaults(userId, address.id);
    return toAddressDto(address);
  }

  async deleteAddress(userId: string, addressId: string): Promise<{ success: true }> {
    await this.assertOwned(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { success: true };
  }

  private async assertOwned(userId: string, addressId: string): Promise<void> {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId)
      throw ApiException.notFound('ADDRESS_NOT_FOUND', 'Address not found');
  }

  private async clearOtherDefaults(userId: string, keepId: string): Promise<void> {
    await this.prisma.address.updateMany({
      where: { userId, id: { not: keepId }, isDefault: true },
      data: { isDefault: false },
    });
  }
}
