import { z } from 'zod';

const coordinate = z.coerce.number().min(-180).max(180);
const positiveInt = z.coerce.number().int().positive();

export const locationQuerySchema = z.object({
  latitude: coordinate.optional(),
  longitude: coordinate.optional(),
});

export const categoryQuerySchema = locationQuerySchema.extend({
  limit: positiveInt.max(12).default(6),
});

export const productQuerySchema = locationQuerySchema.extend({
  page: positiveInt.default(1),
  limit: positiveInt.max(24).default(8),
  search: z.string().trim().max(80).optional(),
  categoryId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const productDetailParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160),
});
