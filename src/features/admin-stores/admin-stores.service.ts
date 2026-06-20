import { Prisma, StoreType } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';
import { assertSuperAdmin } from '@/features/admin/admin-access';
import type { StoreBodyInput, StoreListInput } from './admin-stores.validation';

type UserPayload = { id: string; role: string };

const includeStore = { admins: { where: { deletedAt: null }, include: { user: true }, take: 1 } };

export const listStores = async (rawUser: UserPayload | undefined, query: StoreListInput) => {
  assertSuperAdmin(rawUser);
  const where = storeWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.store.findMany({ where, include: includeStore, skip: skip(query), take: query.limit, orderBy: orderBy(query) }),
    prisma.store.count({ where }),
  ]);
  return { data: items.map(mapStore), meta: meta(query, total) };
};

export const getStore = async (rawUser: UserPayload | undefined, id: string) => {
  assertSuperAdmin(rawUser);
  const store = await prisma.store.findFirst({ where: { id, deletedAt: null }, include: includeStore });
  if (!store) throw new ResponseError(StatusCodes.NOT_FOUND, 'Store not found.');
  return mapStore(store);
};

export const createStore = async (rawUser: UserPayload | undefined, input: StoreBodyInput) => {
  assertSuperAdmin(rawUser);
  await validateStore(input);
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.create({ data: storeData(input) });
    await syncManager(tx, store.id, input.managerUserId || undefined);
    const products = await tx.product.findMany({ where: { deletedAt: null }, select: { id: true } });
    if (products.length) await tx.inventory.createMany({ data: products.map((product) => ({ storeId: store.id, productId: product.id, stock: 0 })), skipDuplicates: true });
    return tx.store.findUniqueOrThrow({ where: { id: store.id }, include: includeStore }).then(mapStore);
  });
};

export const updateStore = async (rawUser: UserPayload | undefined, id: string, input: StoreBodyInput) => {
  assertSuperAdmin(rawUser);
  await ensureStore(id);
  await validateStore(input, id);
  return prisma.$transaction(async (tx) => {
    await tx.store.update({ where: { id }, data: storeData(input) });
    await syncManager(tx, id, input.managerUserId || undefined);
    return tx.store.findUniqueOrThrow({ where: { id }, include: includeStore }).then(mapStore);
  });
};

export const deleteStore = async (rawUser: UserPayload | undefined, id: string) => {
  assertSuperAdmin(rawUser);
  await ensureStore(id);
  await prisma.$transaction([
    prisma.store.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.storeAdmin.updateMany({ where: { storeId: id, deletedAt: null }, data: { deletedAt: new Date() } }),
  ]);
  return { message: 'Store deleted.' };
};

export const listManagers = async (rawUser: UserPayload | undefined) => {
  assertSuperAdmin(rawUser);
  const users = await prisma.user.findMany({ where: { role: 'STORE_ADMIN', deletedAt: null }, orderBy: { name: 'asc' } });
  return users.map((user) => ({ id: user.id, name: user.name ?? user.email, email: user.email }));
};

const storeWhere = (query: StoreListInput): Prisma.StoreWhereInput => ({
  deletedAt: null,
  ...(query.type !== 'all' ? { type: query.type } : {}),
  ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { address: { contains: query.search, mode: 'insensitive' } }] } : {}),
});

const orderBy = (query: StoreListInput): Prisma.StoreOrderByWithRelationInput => ({ [query.sortBy]: query.sortOrder });
const storeData = (input: StoreBodyInput) => ({ name: input.name, address: input.address, latitude: input.latitude, longitude: input.longitude, type: input.type as StoreType });

const validateStore = async (input: StoreBodyInput, excludeId?: string) => {
  if (input.type === 'UTAMA') {
    const main = await prisma.store.findFirst({ where: { type: 'UTAMA', deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (main) throw new ResponseError(StatusCodes.CONFLICT, 'Only one main store is allowed.');
  }
  if (input.managerUserId) {
    const manager = await prisma.user.findFirst({ where: { id: input.managerUserId, role: 'STORE_ADMIN', deletedAt: null } });
    if (!manager) throw new ResponseError(StatusCodes.BAD_REQUEST, 'Manager must be a store admin user.');
  }
};

const syncManager = async (tx: Prisma.TransactionClient, storeId: string, userId?: string) => {
  await tx.storeAdmin.updateMany({ where: { storeId, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!userId) return;
  const existing = await tx.storeAdmin.findUnique({ where: { storeId_userId: { storeId, userId } } });
  if (existing) await tx.storeAdmin.update({ where: { id: existing.id }, data: { deletedAt: null } });
  else await tx.storeAdmin.create({ data: { storeId, userId } });
};

const ensureStore = async (id: string) => {
  const store = await prisma.store.findFirst({ where: { id, deletedAt: null } });
  if (!store) throw new ResponseError(StatusCodes.NOT_FOUND, 'Store not found.');
};

type StoreRecord = Prisma.StoreGetPayload<{ include: typeof includeStore }>;

const mapStore = (store: StoreRecord) => {
  const manager = store.admins[0]?.user;
  return {
    id: store.id,
    name: store.name,
    address: store.address,
    latitude: store.latitude,
    longitude: store.longitude,
    type: store.type,
    createdAt: store.createdAt,
    manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
  };
};

const skip = (query: StoreListInput) => (query.page - 1) * query.limit;
const meta = (query: StoreListInput, total: number) => ({ page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) });
