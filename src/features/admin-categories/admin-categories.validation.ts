import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const categoryIdSchema = z.object({ id: z.string().uuid() });

export const categoryListSchema = z.object({
  page: positiveInt.default(1),
  limit: positiveInt.max(50).default(10),
  search: z.string().trim().max(80).optional(),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const categoryBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
});

export type CategoryListInput = z.infer<typeof categoryListSchema>;
export type CategoryBodyInput = z.infer<typeof categoryBodySchema>;
