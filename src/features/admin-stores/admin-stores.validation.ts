import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const storeIdSchema = z.object({ id: z.string().uuid() });

export const storeListSchema = z.object({
  page: positiveInt.default(1),
  limit: positiveInt.max(50).default(10),
  search: z.string().trim().max(80).optional(),
  type: z.enum(['all', 'UTAMA', 'CABANG']).default('all'),
  sortBy: z.enum(['name', 'type', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const storeBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  type: z.enum(['UTAMA', 'CABANG']).default('CABANG'),
  managerUserId: z.string().uuid().optional().or(z.literal('')),
});

export type StoreListInput = z.infer<typeof storeListSchema>;
export type StoreBodyInput = z.infer<typeof storeBodySchema>;
