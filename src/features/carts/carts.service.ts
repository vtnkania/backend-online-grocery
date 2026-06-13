import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper untuk mengambil atau membuat Cart aktif milik User
export const getOrCreateCart = async (userId: string) => {
  const existingCart = await prisma.cart.findFirst({ where: { userId } });
  if (existingCart) return existingCart;
  return await prisma.cart.create({ data: { userId } });
};

// Feature: Add to Cart & Update Quantity jika barang sudah ada
export const addToCartService = async (userId: string, productId: string, storeId: string, quantity: number) => {
  const cart = await getOrCreateCart(userId);
  const priceSnapshot = await prisma.product.findUnique({ where: { id: productId } }).then(p => p?.price || 0);

  return await prisma.cartItem.upsert({
    where: { cartId_productId_storeId: { cartId: cart.id, productId, storeId } },
    update: { quantity: { increment: quantity } },
    create: { cartId: cart.id, productId, storeId, quantity, priceSnapshot }
  });
};

// Feature: Update Qty Langsung (lewat input angka atau klik + / -)
export const updateCartItemQtyService = async (id: string, quantity: number) => {
  if (quantity <= 0) return await prisma.cartItem.delete({ where: { id } });
  return await prisma.cartItem.update({ where: { id }, data: { quantity } });
};

// Feature: Remove Item dari Cart
export const deleteCartItemService = async (id: string) => {
  return await prisma.cartItem.delete({ where: { id } });
};

// Feature: Get Cart Data untuk List Tampilan User
export const getUserCartService = async (userId: string) => {
  return await prisma.cart.findFirst({
    where: { userId },
    include: { items: { include: { product: true, store: true } } }
  });
};