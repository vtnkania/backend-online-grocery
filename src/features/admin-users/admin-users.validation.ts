import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();
const roles = ['CUSTOMER', 'STORE_ADMIN', 'SUPER_ADMIN'] as const;

export const adminUserIdSchema = z.object({ id: z.string().uuid() });

export const adminUserListSchema = z.object({
  page: positiveInt.default(1),
  limit: positiveInt.max(50).default(10),
  search: z.string().trim().max(80).optional(),
  role: z.enum(['all', ...roles]).default('all'),
  verified: z.enum(['all', 'verified', 'unverified']).default('all'),
  sortBy: z.enum(['name', 'email', 'role', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const adminUserRoleSchema = z.object({
  role: z.enum(roles),
});

export type AdminUserListInput = z.infer<typeof adminUserListSchema>;
export type AdminUserRoleInput = z.infer<typeof adminUserRoleSchema>;
