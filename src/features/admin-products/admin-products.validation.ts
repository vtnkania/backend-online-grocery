import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const productIdSchema = z.object({
  id: z.string().uuid(),
});

export const productListSchema = z.object({
  page: positiveInt.default(1),
  limit: positiveInt.max(50).default(10),
  search: z.string().trim().max(80).optional(),
  categoryId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  stockStatus: z.enum(['all', 'in', 'low', 'out']).default('all'),
  sortBy: z.enum(['name', 'price', 'createdAt', 'stock']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const productBodySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  price: z.coerce.number().positive(),
  isActive: z.coerce.boolean().default(true),
});

export const productUpdateSchema = productBodySchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  'At least one product field is required.',
);

export type ProductListInput = z.infer<typeof productListSchema>;
export type ProductBodyInput = z.infer<typeof productBodySchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
