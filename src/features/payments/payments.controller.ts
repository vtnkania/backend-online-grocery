import { Request, Response } from 'express';
import * as paymentService from './payments.service';

export const confirmPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, amount, bankName, accountNumber, proofUrl } = req.body;

    if (!orderId || !amount || !proofUrl) {
       res.status(400).json({ 
        success: false, 
        message: "Properti orderId, amount, dan proofUrl wajib diisi!" 
      });
       return;
    }

    const result = await paymentService.confirmPaymentService({
      orderId,
      amount: Number(amount),
      bankName,
      accountNumber,
      proofUrl
    });

    res.status(201).json({
      success: true,
      message: "Bukti pembayaran berhasil diunggah! Menunggu konfirmasi admin.",
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const approvePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      res.status(400).json({ success: false, message: "paymentId wajib dikirim!" });
      return;
    }

    const result = await paymentService.approvePaymentService(paymentId);

    res.status(200).json({
      success: true,
      message: "Pembayaran berhasil disetujui! Pesanan siap diproses gudang.",
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleMidtransNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. KITA CEK & LOG DATA ASLI DARI POSTMAN DI TERMINAL VS CODE
    console.log("=== ISI REQ.BODY ASLI DARI POSTMAN ===", req.body);

    // 2. KITA TEMBAK LANGSUNG KEY SNAKE_CASE DARI POSTMAN TANPA DI-MAP LAGI
    const result = await paymentService.processMidtransNotificationService({
      orderId: req.body.order_id,             // Mengambil key "order_id"
      transactionStatus: req.body.transaction_status, // Mengambil key "transaction_status"
      fraudStatus: req.body.fraud_status       // Mengambil key "fraud_status"
    });

    res.status(200).json({
      success: true,
      message: "Webhook Midtrans berhasil diproses otomatis!",
      data: result
    });
  } catch (error: any) {
    console.error("Gagal memproses webhook Midtrans:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createQrisPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      res.status(400).json({ success: false, message: "orderId wajib dikirim!" });
      return;
    }

    const result = await paymentService.createMidtransQrisService(orderId);

    res.status(200).json({
      success: true,
      message: "Berhasil membuat QR Code pembayaran Midtrans!",
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};