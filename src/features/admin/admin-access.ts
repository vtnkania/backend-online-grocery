import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';

type UserPayload = { id: string; role: string };

export const assertAdminUser = (user?: UserPayload) => {
  if (!user) throw new ResponseError(StatusCodes.UNAUTHORIZED, 'Authentication required.');
  if (!['SUPER_ADMIN', 'STORE_ADMIN'].includes(user.role)) {
    throw new ResponseError(StatusCodes.FORBIDDEN, 'Admin access required.');
  }
  return user;
};

export const getAssignedStoreIds = async (userId: string) => {
  const stores = await prisma.storeAdmin.findMany({
    where: { userId, deletedAt: null, store: { deletedAt: null } },
    select: { storeId: true },
  });
  return stores.map((store) => store.storeId);
};

export const resolveReadableStores = async (user: UserPayload, storeId?: string) => {
  if (user.role === 'SUPER_ADMIN') return storeId ? [storeId] : undefined;
  const assignedIds = await getAssignedStoreIds(user.id);
  if (storeId && !assignedIds.includes(storeId)) {
    throw new ResponseError(StatusCodes.FORBIDDEN, 'Store is outside your access.');
  }
  return storeId ? [storeId] : assignedIds;
};

export const resolveWritableStore = async (user: UserPayload, storeId: string) => {
  if (user.role === 'SUPER_ADMIN') return storeId;
  throw new ResponseError(StatusCodes.FORBIDDEN, 'Store admin access is read-only.');
};
