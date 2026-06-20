import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const mutationIdSchema = z.object({ id: z.string().uuid() });

export const mutationListSchema = z.object({
  page: positiveInt.default(1),
  limit: positiveInt.max(50).default(10),
  search: z.string().trim().max(80).optional(),
  status: z.enum(['all', 'REQUESTED', 'REJECTED', 'ACCEPTED', 'SHIPPED', 'RECEIVED']).default('all'),
  sourceStoreId: z.string().uuid().optional(),
  destinationStoreId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'status', 'product']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const mutationRequestSchema = z.object({
  productId: z.string().uuid(),
  sourceStoreId: z.string().uuid(),
  destinationStoreId: z.string().uuid(),
  quantity: positiveInt,
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type MutationListInput = z.infer<typeof mutationListSchema>;
export type MutationRequestInput = z.infer<typeof mutationRequestSchema>;
