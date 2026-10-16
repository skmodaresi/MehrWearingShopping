import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalAuth } from '../../common/decorators/auth.decorators';
import { AuthedRequest } from '../../common/decorators/current-user.decorator';
import { CartContext, CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /**
   * Cart identity:
   *  - `Authorization: Bearer …` → that user's cart (guest carts merge in),
   *  - `x-cart-id: <uuid>` → the guest cart (issued by this endpoint),
   *  - neither → a brand-new guest cart (its id comes back in the response).
   */
  private context(request: AuthedRequest): CartContext {
    const header = request.headers['x-cart-id'];
    const cartId = typeof header === 'string' && header.length >= 10 ? header : undefined;
    return { userId: request.user?.sub, cartId };
  }

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current cart (creates one for anonymous callers)' })
  get(@Req() request: AuthedRequest) {
    return this.cart.getCart(this.context(request));
  }

  @Post('items')
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an item to the cart' })
  add(@Req() request: AuthedRequest, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(this.context(request), dto.variantId, dto.qty ?? 1);
  }

  @Patch('items/:variantId')
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change item quantity' })
  update(
    @Req() request: AuthedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(this.context(request), variantId, dto.qty);
  }

  @Delete('items/:variantId')
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an item' })
  remove(@Req() request: AuthedRequest, @Param('variantId') variantId: string) {
    return this.cart.removeItem(this.context(request), variantId);
  }
}
