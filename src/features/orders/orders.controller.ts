import { Request, Response } from 'express';
import { createOrderService } from './orders.service';
import * as orderService from './orders.service';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, courierCompany, courierName, shippingCost } = req.body;

    if (!userId || !courierCompany || !courierName || shippingCost === undefined) {
      res.status(400).json({
        success: false,
        message: "Gagal membuat order. Parameter userId, courierCompany, courierName, dan shippingCost wajib diisi!"
      });
      return;
    }

    console.log(`==== [CREATING ORDER] ====`);
    console.log(`Memproses pembuatan Order ID untuk User: ${userId}`);

    const order = await createOrderService({
      userId,
      courierCompany,
      courierName,
      shippingCost: Number(shippingCost)
    });

    res.status(201).json({
      success: true,
      message: "Pesanan berhasil dibuat! Keranjang otomatis dikosongkan.",
      data: order
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getUserOrdersHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    // Mengambil userId dari query parameter (Contoh: /orders?userId=xxxx)
    const userId = req.query.userId as string;

    const orders = await orderService.getUserOrdersHistoryService(userId);

    res.status(200).json({
      success: true,
      message: "Riwayat pesanan berhasil diambil.",
      data: orders
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const completeOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      res.status(400).json({ success: false, message: "Parameter orderId wajib diisi!" });
      return;
    }

    const updatedOrder = await orderService.completeOrderService(orderId);

    res.status(200).json({
      success: true,
      message: "Transaksi selesai! Terima kasih telah berbelanja di Online Grocery.",
      data: {
        orderId: updatedOrder.id,
        orderStatus: updatedOrder.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      res.status(400).json({ success: false, message: "Parameter orderId wajib diisi!" });
      return;
    }

    const updatedOrder = await orderService.cancelOrderService(orderId);

    res.status(200).json({
      success: true,
      message: "Pesanan Anda berhasil dibatalkan.",
      data: {
        orderId: updatedOrder.id,
        orderStatus: updatedOrder.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};