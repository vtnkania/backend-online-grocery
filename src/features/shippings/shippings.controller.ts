import { Request, Response } from 'express';
import { getBiteshipRates } from './shippings.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const calculateRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    // 1. Validasi awal: Cukup membutuhkan userId saja dari frontend!
    if (!userId) {
      res.status(400).json({
        success: false,
        message: "Gagal memproses request. Parameter userId wajib diisi!"
      });
      return;
    }

    console.log("=== [INTEGRATED REQUEST] ===");
    console.log(`Mencari alamat utama untuk UserID: ${userId}`);

    // 2. Cari alamat aktif utama (isPrimary) milik user di database alamat kamu
    const primaryAddress = await prisma.address.findFirst({
      where: { 
        userId: String(userId),
        isPrimary: true,
        deletedAt: null
      }
    });

    if (!primaryAddress) {
      res.status(404).json({
        success: false,
        message: "Gagal menghitung ongkir. User belum menentukan alamat utama!"
      });
      return;
    }

    console.log(`🏠 Alamat Utama Ditemukan: ${primaryAddress.label} (${primaryAddress.latitude}, ${primaryAddress.longitude})`);

    // 3. Oper koordinat hasil pencarian database langsung ke Biteship Service
    const rates = await getBiteshipRates({
      destLat: Number(primaryAddress.latitude),
      destLng: Number(primaryAddress.longitude),
      userId: String(userId)
    });

    res.status(200).json({
      success: true,
      data: rates
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

import * as shippingService from './shippings.service'; // Pastikan ada / tambahkan jika belum

export const shipOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, resi } = req.body;

    if (!orderId || !resi) {
      res.status(400).json({ 
        success: false, 
        message: "Parameter orderId dan resi wajib diisi!" 
      });
      return;
    }

    // Eksekusi fungsi update resi & status orderan
    const result = await shippingService.shipOrderService({ orderId, resi });

    res.status(200).json({
      success: true,
      message: "Pesanan berhasil diserahkan ke kurir! Nomor resi telah dicatat.",
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};