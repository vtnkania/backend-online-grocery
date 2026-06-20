import { Prisma, RoleType } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';
import { assertSuperAdmin } from '@/features/admin/admin-access';
import type { AdminUserListInput } from './admin-users.validation';

type UserPayload = { id: string; role: string };
const selectUser = {
  id: true, name: true, email: true, role: true, isVerified: true,
  emailVerifiedAt: true, profileImageUrl: true, createdAt: true,
} as const;

export const listUsers = async (query: AdminUserListInput) => {
  const where = userWhere(query);
  const [users, total, stats] = await Promise.all([
    prisma.user.findMany({ where, select: selectUser, skip: skip(query), take: query.limit, orderBy: orderBy(query) }),
    prisma.user.count({ where }),
    getStats(),
  ]);
  return { data: users.map(mapUser), meta: meta(query, total), stats };
};

export const updateUserRole = async (rawUser: UserPayload | undefined, id: string, role: RoleType) => {
  const actor = assertSuperAdmin(rawUser);
  if (actor.id === id) throw new ResponseError(StatusCodes.BAD_REQUEST, 'You cannot change your own role.');
  const user = await getActiveUser(id);
  if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') await ensureAnotherSuperAdmin(id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role } });
    if (role !== 'STORE_ADMIN') await tx.storeAdmin.updateMany({ where: { userId: id, deletedAt: null }, data: { deletedAt: new Date() } });
  });
  return prisma.user.findUniqueOrThrow({ where: { id }, select: selectUser }).then(mapUser);
};

export const deleteUser = async (rawUser: UserPayload | undefined, id: string) => {
  const actor = assertSuperAdmin(rawUser);
  if (actor.id === id) throw new ResponseError(StatusCodes.BAD_REQUEST, 'You cannot delete your own account.');
  const user = await getActiveUser(id);
  if (user.role === 'SUPER_ADMIN') await ensureAnotherSuperAdmin(id);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.storeAdmin.updateMany({ where: { userId: id, deletedAt: null }, data: { deletedAt: new Date() } }),
  ]);
  return { message: 'User deleted.' };
};

const getStats = async () => {
  const active = { deletedAt: null };
  const [totalUsers, customers, staffAccounts, verifiedUsers] = await Promise.all([
    prisma.user.count({ where: active }),
    prisma.user.count({ where: { ...active, role: 'CUSTOMER' } }),
    prisma.user.count({ where: { ...active, role: { in: ['STORE_ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.user.count({ where: { ...active, isVerified: true } }),
  ]);
  return { totalUsers, customers, staffAccounts, verifiedUsers };
};

const userWhere = (query: AdminUserListInput): Prisma.UserWhereInput => ({
  deletedAt: null,
  ...(query.role !== 'all' ? { role: query.role } : {}),
  ...(query.verified === 'verified' ? { isVerified: true } : {}),
  ...(query.verified === 'unverified' ? { isVerified: false } : {}),
  ...(query.search ? { OR: [
    { name: { contains: query.search, mode: 'insensitive' } },
    { email: { contains: query.search, mode: 'insensitive' } },
  ] } : {}),
});

const orderBy = (query: AdminUserListInput): Prisma.UserOrderByWithRelationInput => ({ [query.sortBy]: query.sortOrder });
const skip = (query: AdminUserListInput) => (query.page - 1) * query.limit;
const meta = (query: AdminUserListInput, total: number) => ({ page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) });

const getActiveUser = async (id: string) => {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, role: true } });
  if (!user) throw new ResponseError(StatusCodes.NOT_FOUND, 'User not found.');
  return user;
};

const ensureAnotherSuperAdmin = async (id: string) => {
  const count = await prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null, id: { not: id } } });
  if (!count) throw new ResponseError(StatusCodes.BAD_REQUEST, 'At least one active super admin is required.');
};

type UserRecord = Prisma.UserGetPayload<{ select: typeof selectUser }>;
const mapUser = (user: UserRecord) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
  emailVerifiedAt: user.emailVerifiedAt,
  profileImageUrl: user.profileImageUrl,
  createdAt: user.createdAt,
});
