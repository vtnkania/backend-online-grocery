import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';
import { assertSuperAdmin } from '@/features/admin/admin-access';
import type { CategoryBodyInput, CategoryListInput } from './admin-categories.validation';

type UserPayload = { id: string; role: string };

export const listCategories = async (rawUser: UserPayload | undefined, query: CategoryListInput) => {
  assertSuperAdmin(rawUser);
  const where = categoryWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({ where, skip: skip(query), take: query.limit, orderBy: orderBy(query), include: { _count: { select: { products: true } } } }),
    prisma.category.count({ where }),
  ]);
  return { data: items.map(mapCategory), meta: meta(query, total) };
};

export const createCategory = async (rawUser: UserPayload | undefined, input: CategoryBodyInput) => {
  assertSuperAdmin(rawUser);
  await ensureUniqueName(input.name);
  return prisma.category.create({ data: bodyData(input), include: { _count: { select: { products: true } } } }).then(mapCategory);
};

export const updateCategory = async (rawUser: UserPayload | undefined, id: string, input: CategoryBodyInput) => {
  assertSuperAdmin(rawUser);
  await ensureCategory(id);
  await ensureUniqueName(input.name, id);
  return prisma.category.update({ where: { id }, data: bodyData(input), include: { _count: { select: { products: true } } } }).then(mapCategory);
};

export const deleteCategory = async (rawUser: UserPayload | undefined, id: string) => {
  assertSuperAdmin(rawUser);
  await ensureCategory(id);
  const used = await prisma.product.count({ where: { categoryId: id, deletedAt: null } });
  if (used) throw new ResponseError(StatusCodes.BAD_REQUEST, 'Category is still used by active products.');
  await prisma.category.delete({ where: { id } });
  return { message: 'Category deleted.' };
};

const categoryWhere = (query: CategoryListInput): Prisma.CategoryWhereInput => ({
  ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
});

const orderBy = (query: CategoryListInput): Prisma.CategoryOrderByWithRelationInput => ({ [query.sortBy]: query.sortOrder });

const bodyData = (input: CategoryBodyInput) => ({ name: input.name, imageUrl: input.imageUrl || null });

const ensureUniqueName = async (name: string, excludeId?: string) => {
  const category = await prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  if (category) throw new ResponseError(StatusCodes.CONFLICT, 'Category name already exists.');
};

const ensureCategory = async (id: string) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new ResponseError(StatusCodes.NOT_FOUND, 'Category not found.');
};

const mapCategory = (item: { id: string; name: string; imageUrl: string | null; createdAt: Date; _count: { products: number } }) => ({
  id: item.id,
  name: item.name,
  imageUrl: item.imageUrl,
  createdAt: item.createdAt,
  productCount: item._count.products,
});

const skip = (query: CategoryListInput) => (query.page - 1) * query.limit;
const meta = (query: CategoryListInput, total: number) => ({ page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) });
