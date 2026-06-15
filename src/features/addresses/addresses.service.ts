import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

export const createAddressService = async (userId: string, data: {
  addressName: string;
  receiverName: string;
  phoneNumber: string;
  addressDetails: string;
  province: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  isPrimary?: boolean;
}) => {
  if (data.isPrimary) {
    await prisma.address.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const existingAddressesCount = await prisma.address.count({
    where: { userId },
  });
  
  const shouldBePrimary = existingAddressesCount === 0 ? true : !!data.isPrimary;

  return await prisma.address.create({
    data: {
      userId,
      label: data.addressName,
      receiver: data.receiverName,
      phone: data.phoneNumber,
      address: data.addressDetails,
      isPrimary: shouldBePrimary,
      province: data.province,     // Menerima input dinamis
      city: data.city,             // Menerima input dinamis
      district: data.district,     // Menerima input dinamis
      latitude: Number(data.latitude),   // Menjamin tipe data Float untuk hitungan jarak
      longitude: Number(data.longitude)  // Menjamin tipe data Float untuk hitungan jarak
    },
  });
};