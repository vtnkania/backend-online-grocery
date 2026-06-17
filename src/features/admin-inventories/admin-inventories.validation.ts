import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const inventoryIdSchema = z.object({
  id: z.string().uuid(),
});

export const inventoryListSchema = z.object({
  page: positiveInt.default(1),
  limit: positiveInt.max(50).default(10),
  search: z.string().trim().max(80).optional(),
  storeId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  stockStatus: z.enum(['all', 'in', 'low', 'out']).default('all'),
  sortBy: z.enum(['product', 'store', 'stock', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const inventoryBodySchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
  stock: z.coerce.number().int().min(0),
});

export const stockUpdateSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: positiveInt,
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type InventoryListInput = z.infer<typeof inventoryListSchema>;
export type InventoryBodyInput = z.infer<typeof inventoryBodySchema>;
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
