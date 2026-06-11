import { Request, Response } from 'express';
import * as addressService from './addresses.service';

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    // Agar bisa menerima userId yang kita kirim manual lewat Postman body
    const userId = (req as any).user?.id || req.body.userId || "dummy-user-id-untuk-testing"; 
    const result = await addressService.createAddressService(userId, req.body);
    res.status(201).json({ message: 'Address created successfully', data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

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