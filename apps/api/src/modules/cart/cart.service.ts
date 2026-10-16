import { Injectable } from '@nestjs/common';
import { Cart, CartItem, Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CartItemDto {
  variantId: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorEn: string | null;
  colorHex: string | null;
  qty: number;
  unitPriceToman: number;
  lineTotalToman: number;
  stock: number;
  available: boolean;
  product: {
    id: string;
    slug: string;
    nameFa: string;
    nameEn: string;
    image: string | null;
  };
}

export interface CartDto {
  cartId: string;
  items: CartItemDto[];
  itemCount: number;
  subtotalToman: number;
}

export interface CartContext {
  userId?: string;
  cartId?: string;
}

/**
 * Server-side cart:
 *  - logged-in callers always use their own cart;
 *  - guests are identified by an `x-cart-id` header (issued by the API and
 *    stored client-side — the web app keeps it in an httpOnly cookie);
 *  - when a guest signs in, their cart is merged into the user cart.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(context: CartContext): Promise<CartDto> {
    const cart = await this.resolveCart(context);
    return this.toDto(cart);
  }

  async addItem(context: CartContext, variantId: string, qty: number): Promise<CartDto> {
    const cart = await this.resolveCart(context);
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true } } },
    });
    if (!variant || variant.product.status !== 'ACTIVE') {
      throw ApiException.notFound('VARIANT_NOT_FOUND', 'Selected variant is not available');
    }

    const existing = cart.items.find((item) => item.variantId === variantId);
    const desired = (existing?.qty ?? 0) + qty;
    if (desired > variant.stock) {
      throw ApiException.conflict('OUT_OF_STOCK', 'Not enough stock for the requested quantity', {
        available: variant.stock,
        requested: desired,
      });
    }

    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { qty: desired } });
    } else {
      await this.prisma.cartItem.create({ data: { cartId: cart.id, variantId, qty } });
    }
    return this.toDto(await this.reload(cart.id));
  }

  async updateItem(context: CartContext, variantId: string, qty: number): Promise<CartDto> {
    const cart = await this.resolveCart(context);
    const item = cart.items.find((entry) => entry.variantId === variantId);
    if (!item) throw ApiException.notFound('CART_ITEM_NOT_FOUND', 'Item is not in the cart');

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { stock: true },
    });
    if (!variant) throw ApiException.notFound('VARIANT_NOT_FOUND', 'Variant no longer exists');
    if (qty > variant.stock) {
      throw ApiException.conflict('OUT_OF_STOCK', 'Not enough stock for the requested quantity', {
        available: variant.stock,
        requested: qty,
      });
    }
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { qty } });
    return this.toDto(await this.reload(cart.id));
  }

  async removeItem(context: CartContext, variantId: string): Promise<CartDto> {
    const cart = await this.resolveCart(context);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return this.toDto(await this.reload(cart.id));
  }

  // -------------------------------------------------------------------------

  /** Resolves (and lazily creates) the caller's cart, merging guest carts on login. */
  private async resolveCart(context: CartContext): Promise<Cart & { items: CartItem[] }> {
    if (context.userId) {
      let cart = await this.prisma.cart.findUnique({
        where: { userId: context.userId },
        include: { items: true },
      });

      // Merge any guest cart carried over from before sign-in.
      if (context.cartId && context.cartId !== cart?.id) {
        const guest = await this.prisma.cart.findUnique({
          where: { id: context.cartId },
          include: { items: true },
        });
        if (guest && guest.userId === null) {
          if (!cart) {
            cart = await this.prisma.cart.create({
              data: { userId: context.userId },
              include: { items: true },
            });
          }
          for (const item of guest.items) {
            const variant = await this.prisma.productVariant.findUnique({
              where: { id: item.variantId },
            });
            if (!variant) continue;
            const current = await this.prisma.cartItem.findUnique({
              where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
            });
            const qty = Math.min((current?.qty ?? 0) + item.qty, Math.max(variant.stock, 1));
            if (current) {
              await this.prisma.cartItem.update({ where: { id: current.id }, data: { qty } });
            } else {
              await this.prisma.cartItem.create({
                data: { cartId: cart.id, variantId: item.variantId, qty },
              });
            }
          }
          await this.prisma.cart.delete({ where: { id: guest.id } }).catch(() => undefined);
          cart = await this.prisma.cart.findUnique({
            where: { id: cart.id },
            include: { items: true },
          });
        }
      }

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId: context.userId },
          include: { items: true },
        });
      }
      return cart;
    }

    // Guest cart.
    if (context.cartId) {
      const guest = await this.prisma.cart.findUnique({
        where: { id: context.cartId },
        include: { items: true },
      });
      if (guest && guest.userId === null) return guest;
    }
    return this.prisma.cart.create({ data: {}, include: { items: true } });
  }

  private async reload(cartId: string): Promise<Cart & { items: CartItem[] }> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });
    if (!cart) throw ApiException.notFound('CART_NOT_FOUND', 'Cart disappeared');
    return cart;
  }

  private async toDto(cart: Cart & { items: CartItem[] }): Promise<CartDto> {
    const items =
      cart.items.length > 0
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: cart.items.map((item) => item.variantId) } },
            include: {
              product: {
                select: {
                  id: true,
                  slug: true,
                  nameFa: true,
                  nameEn: true,
                  status: true,
                  priceToman: true,
                  images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
                },
              },
            },
          })
        : [];

    const byId = new Map(items.map((variant) => [variant.id, variant]));
    const rows: CartItemDto[] = [];

    for (const item of cart.items) {
      const variant = byId.get(item.variantId);
      if (!variant) continue; // variant deleted meanwhile
      const unitPrice = variant.priceToman ?? variant.product.priceToman;
      rows.push({
        variantId: variant.id,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        colorEn: variant.colorEn,
        colorHex: variant.colorHex,
        qty: item.qty,
        unitPriceToman: unitPrice,
        lineTotalToman: unitPrice * item.qty,
        stock: variant.stock,
        available: variant.product.status === 'ACTIVE',
        product: {
          id: variant.product.id,
          slug: variant.product.slug,
          nameFa: variant.product.nameFa,
          nameEn: variant.product.nameEn,
          image: variant.product.images[0]?.url ?? null,
        },
      });
    }

    const available = rows.filter((row) => row.available);
    return {
      cartId: cart.id,
      items: rows,
      itemCount: available.reduce((sum, row) => sum + row.qty, 0),
      subtotalToman: available.reduce((sum, row) => sum + row.lineTotalToman, 0),
    };
  }
}

export type { Prisma };
