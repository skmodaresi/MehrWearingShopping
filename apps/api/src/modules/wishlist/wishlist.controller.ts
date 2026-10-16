import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'My wishlist' })
  list(@CurrentUser() user: JwtPayload) {
    return this.wishlist.list(user.sub);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add a product to the wishlist' })
  add(@CurrentUser() user: JwtPayload, @Param('productId') productId: string) {
    return this.wishlist.add(user.sub, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  remove(@CurrentUser() user: JwtPayload, @Param('productId') productId: string) {
    return this.wishlist.remove(user.sub, productId);
  }
}
