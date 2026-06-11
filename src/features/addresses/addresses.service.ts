import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createAddressService = async (userId: string, data: any) => {
  if (data.isPrimary) {
    await prisma.address.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  return await prisma.address.create({
    data: { ...data, userId },
  });
};

export const getUserAddressesService = async (userId: string) => {
  return await prisma.address.findMany({
    where: { userId, deletedAt: null },
    orderBy: { isPrimary: 'desc' },
  });
};

export const updateAddressService = async (addressId: string, userId: string, data: any) => {
  if (data.isPrimary) {
    await prisma.address.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  return await prisma.address.update({
    where: { id: addressId, userId },
    data,
  });
};

export const deleteAddressService = async (addressId: string, userId: string) => {
  return await prisma.address.update({
    where: { id: addressId, userId },
    data: { deletedAt: new Date() }, // Menggunakan soft-delete
  });
};