import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AddressDto, ChangePasswordDto, UpdateProfileDto } from './dto';
import { UserDto } from '../auth/auth.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update the current profile' })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('me/password')
  @ApiOperation({ summary: 'Change password (revokes all refresh tokens)' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    return this.usersService.changePassword(user.sub, dto);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'List saved addresses' })
  listAddresses(@CurrentUser() user: JwtPayload) {
    return this.usersService.listAddresses(user.sub);
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'Save a new address' })
  createAddress(@CurrentUser() user: JwtPayload, @Body() dto: AddressDto) {
    return this.usersService.createAddress(user.sub, dto);
  }

  @Patch('me/addresses/:id')
  @ApiOperation({ summary: 'Update a saved address' })
  updateAddress(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddressDto) {
    return this.usersService.updateAddress(user.sub, id, dto);
  }

  @Delete('me/addresses/:id')
  @ApiOperation({ summary: 'Delete a saved address' })
  deleteAddress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.deleteAddress(user.sub, id);
  }
}
