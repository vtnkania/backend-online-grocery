import { Request, Response } from 'express';
import * as addressService from './addresses.service';

export const getUserAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ganti string di bawah ini dengan UUID milik Bagus Test dari Prisma Studio kamu
    const userId = "c2ab071d-03b2-4343-a842-210d4e208d89";
    
    const result = await addressService.getUserAddressesService(userId);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    // Masih menggunakan hardcode userId yang sama dengan kemarin untuk keperluan test
    const userId = "c2ab071d-03b2-4343-a842-210d4e208d89"; 
    const { addressName, receiverName, phoneNumber, addressDetails, isPrimary } = req.body;

    // Validasi input standar
    if (!addressName || !receiverName || !phoneNumber || !addressDetails) {
      res.status(400).json({ message: "Semua kolom input wajib diisi!" });
      return;
    }

    const newAddress = await addressService.createAddressService(userId, {
      addressName,
      receiverName,
      phoneNumber,
      addressDetails,
      isPrimary
    });

    res.status(201).json({
      message: "Alamat baru berhasil ditambahkan!",
      data: newAddress
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const addressId = req.params.id as string; // <--- Sudah diperbaiki memakai Type Casting
    // Gunakan userId dummy yang sama dengan fungsi GET dan POST kemarin
    const userId = "c2ab071d-03b2-4343-a842-210d4e208d89"; 
    const { isPrimary } = req.body;

    const updatedAddress = await addressService.updateAddressService(addressId, userId, {
      isPrimary
    });

    res.status(200).json({
      message: "Alamat berhasil diperbarui!",
      data: updatedAddress
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};