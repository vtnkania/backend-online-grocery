import { MutationType, Prisma, StockMutationStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';
import { assertAdminUser, assertStoreAccess, getAssignedStoreIds, resolveReadableStores } from '@/features/admin/admin-access';
import type { MutationListInput, MutationRequestInput } from './admin-stock-mutations.validation';

type UserPayload = { id: string; role: string };

const includeMutation = {
  inventory: { include: { store: true, product: { include: { category: true, productImages: { take: 1 } } } } },
  destinationInventory: { include: { store: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
};

export const listMutations = async (rawUser: UserPayload | undefined, query: MutationListInput) => {
  const user = assertAdminUser(rawUser);
  const storeIds = await resolveReadableStores(user);
  const where = mutationWhere(query, storeIds);
  const [items, total] = await prisma.$transaction([
    prisma.stockMutation.findMany({ where, include: includeMutation, skip: skip(query), take: query.limit, orderBy: orderBy(query) }),
    prisma.stockMutation.count({ where }),
  ]);
  return { data: items.map((item) => mapMutation(item, user, storeIds)), meta: meta(query, total) };
};

export const requestMutation = async (rawUser: UserPayload | undefined, input: MutationRequestInput) => {
  const user = assertAdminUser(rawUser);
  if (input.sourceStoreId === input.destinationStoreId) {
    throw new ResponseError(StatusCodes.BAD_REQUEST, 'Source and destination stores must be different.');
  }
  await assertStoreAccess(user, input.destinationStoreId);
  const source = await ensureInventory(input.sourceStoreId, input.productId);
  const destination = await ensureInventory(input.destinationStoreId, input.productId);
  const item = await prisma.stockMutation.create({
    data: {
      inventoryId: source.id,
      destinationInventoryId: destination.id,
      type: MutationType.TRANSFER,
      quantity: input.quantity,
      status: StockMutationStatus.REQUESTED,
      referenceType: 'TRANSFER',
      notes: input.notes || null,
      requestedById: user.id,
    },
    include: includeMutation,
  });
  return mapMutation(item, user, await assignedIds(user));
};

export const listStores = async (rawUser: UserPayload | undefined) => {
  assertAdminUser(rawUser);
  return prisma.store.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
};

export const acceptMutation = (rawUser: UserPayload | undefined, id: string) =>
  transition(rawUser, id, StockMutationStatus.REQUESTED, StockMutationStatus.ACCEPTED, 'acceptedById', 'acceptedAt', 'source');

export const rejectMutation = (rawUser: UserPayload | undefined, id: string) =>
  transition(rawUser, id, StockMutationStatus.REQUESTED, StockMutationStatus.REJECTED, 'rejectedById', 'rejectedAt', 'source');

export const shipMutation = async (rawUser: UserPayload | undefined, id: string) => {
  const user = assertAdminUser(rawUser);
  return prisma.$transaction(async (tx) => {
    const item = await getMutation(tx, id);
    await assertStoreAccess(user, item.inventory.storeId);
    if (item.status !== StockMutationStatus.ACCEPTED) throw invalidStatus();
    if (item.inventory.stock < item.quantity) throw new ResponseError(StatusCodes.BAD_REQUEST, 'Source stock is insufficient.');
    await tx.inventory.update({ where: { id: item.inventoryId }, data: { stock: { decrement: item.quantity } } });
    const saved = await tx.stockMutation.update({ where: { id }, data: { status: 'SHIPPED', shippedById: user.id, shippedAt: new Date() }, include: includeMutation });
    return mapMutation(saved, user, await assignedIds(user));
  });
};

export const receiveMutation = async (rawUser: UserPayload | undefined, id: string) => {
  const user = assertAdminUser(rawUser);
  return prisma.$transaction(async (tx) => {
    const item = await getMutation(tx, id);
    if (!item.destinationInventoryId || !item.destinationInventory) throw new ResponseError(StatusCodes.BAD_REQUEST, 'Destination inventory is missing.');
    await assertStoreAccess(user, item.destinationInventory.storeId);
    if (item.status !== StockMutationStatus.SHIPPED) throw invalidStatus();
    await tx.inventory.update({ where: { id: item.destinationInventoryId }, data: { stock: { increment: item.quantity } } });
    const saved = await tx.stockMutation.update({ where: { id }, data: { status: 'RECEIVED', receivedById: user.id, receivedAt: new Date() }, include: includeMutation });
    return mapMutation(saved, user, await assignedIds(user));
  });
};

const transition = async (
  rawUser: UserPayload | undefined,
  id: string,
  from: StockMutationStatus,
  to: StockMutationStatus,
  userField: 'acceptedById' | 'rejectedById',
  dateField: 'acceptedAt' | 'rejectedAt',
  access: 'source',
) => {
  const user = assertAdminUser(rawUser);
  const item = await prisma.stockMutation.findUnique({ where: { id }, include: includeMutation });
  if (!item) throw new ResponseError(StatusCodes.NOT_FOUND, 'Stock mutation not found.');
  if (access === 'source') await assertStoreAccess(user, item.inventory.storeId);
  if (item.status !== from) throw invalidStatus();
  const saved = await prisma.stockMutation.update({ where: { id }, data: { status: to, [userField]: user.id, [dateField]: new Date() }, include: includeMutation });
  return mapMutation(saved, user, await assignedIds(user));
};

const mutationWhere = (query: MutationListInput, storeIds?: string[]): Prisma.StockMutationWhereInput => ({
  type: 'TRANSFER',
  ...(query.status !== 'all' ? { status: query.status } : {}),
  ...(query.sourceStoreId ? { inventory: { storeId: query.sourceStoreId } } : {}),
  ...(query.destinationStoreId ? { destinationInventory: { storeId: query.destinationStoreId } } : {}),
  ...(storeIds ? { OR: [{ inventory: { storeId: { in: storeIds } } }, { destinationInventory: { storeId: { in: storeIds } } }] } : {}),
  ...(query.search ? { inventory: { product: { name: { contains: query.search, mode: 'insensitive' } } } } : {}),
});

const orderBy = (query: MutationListInput): Prisma.StockMutationOrderByWithRelationInput => {
  if (query.sortBy === 'status') return { status: query.sortOrder };
  if (query.sortBy === 'product') return { inventory: { product: { name: query.sortOrder } } };
  return { createdAt: query.sortOrder };
};

const ensureInventory = async (storeId: string, productId: string) => {
  const inventory = await prisma.inventory.findUnique({ where: { storeId_productId: { storeId, productId } } });
  if (!inventory) throw new ResponseError(StatusCodes.NOT_FOUND, 'Inventory not found for selected store and product.');
  return inventory;
};

const getMutation = (tx: Prisma.TransactionClient, id: string) =>
  tx.stockMutation.findUnique({ where: { id }, include: includeMutation }).then((item) => {
    if (!item) throw new ResponseError(StatusCodes.NOT_FOUND, 'Stock mutation not found.');
    return item;
  });

type MutationRecord = Prisma.StockMutationGetPayload<{ include: typeof includeMutation }>;

const mapMutation = (item: MutationRecord, user: UserPayload, storeIds?: string[]) => ({
  id: item.id,
  productId: item.inventory.productId,
  productName: item.inventory.product.name,
  categoryName: item.inventory.product.category.name,
  imageUrl: item.inventory.product.productImages[0]?.url ?? null,
  sourceStoreId: item.inventory.storeId,
  sourceStoreName: item.inventory.store.name,
  destinationStoreId: item.destinationInventory?.storeId ?? null,
  destinationStoreName: item.destinationInventory?.store.name ?? null,
  quantity: item.quantity,
  status: item.status,
  notes: item.notes,
  createdAt: item.createdAt,
  requestedBy: item.requestedBy ? { id: item.requestedBy.id, name: item.requestedBy.name, email: item.requestedBy.email } : null,
  permissions: permissions(item, user, storeIds),
});

const permissions = (item: MutationRecord, user: UserPayload, storeIds?: string[]) => {
  const source = user.role === 'SUPER_ADMIN' || Boolean(storeIds?.includes(item.inventory.storeId));
  const destId = item.destinationInventory?.storeId;
  const dest = user.role === 'SUPER_ADMIN' || Boolean(destId && storeIds?.includes(destId));
  return {
    canAccept: source && item.status === 'REQUESTED',
    canReject: source && item.status === 'REQUESTED',
    canShip: source && item.status === 'ACCEPTED',
    canReceive: dest && item.status === 'SHIPPED',
  };
};

const assignedIds = async (user: UserPayload) => user.role === 'SUPER_ADMIN' ? undefined : getAssignedStoreIds(user.id);
const invalidStatus = () => new ResponseError(StatusCodes.BAD_REQUEST, 'Stock mutation status does not allow this action.');
const skip = (query: MutationListInput) => (query.page - 1) * query.limit;
const meta = (query: MutationListInput, total: number) => ({ page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) });
