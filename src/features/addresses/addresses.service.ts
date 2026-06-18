import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Ambil Alamat Milik User Aktif yang Belum Dihapus
export const getUserAddressesService = async (userId: string) => {
  return await prisma.address.findMany({
    where: { userId, deletedAt: null },
    orderBy: { isPrimary: 'desc' },
  });
};

// 2. Buat Alamat Baru
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
  // Jika alamat baru dijadikan alamat utama, reset alamat lama lainnya jadi false
  if (data.isPrimary) {
    await prisma.address.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  // Cek jumlah alamat saat ini
  const existingAddressesCount = await prisma.address.count({
    where: { userId, deletedAt: null },
  });
  
  // Jika ini alamat pertama sekali, otomatis paksa jadikan true (alamat utama)
  const shouldBePrimary = existingAddressesCount === 0 ? true : !!data.isPrimary;

  return await prisma.address.create({
    data: {
      userId,
      label: data.addressName,
      receiver: data.receiverName,
      phone: data.phoneNumber,
      address: data.addressDetails,
      isPrimary: shouldBePrimary,
      province: data.province,     
      city: data.city,             
      district: data.district,     
      latitude: Number(data.latitude),   
      longitude: Number(data.longitude)  
    },
  });
};

// 3. Update Detail Alamat
export const updateAddressService = async (addressId: string, userId: string, data: any) => {
  // Jika diubah menjadi alamat utama, matikan status alamat utama lama milik user ini
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

// 4. Soft-Delete Alamat (Hanya menandai kolom deletedAt tanpa menghapus permanen row)
export const deleteAddressService = async (addressId: string, userId: string) => {
  return await prisma.address.update({
    where: { id: addressId, userId },
    data: { deletedAt: new Date() }, 
  });
};