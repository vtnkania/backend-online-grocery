import { Request, Response } from 'express';
import * as cartService from './carts.service';

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = "c2ab071d-03b2-4343-a842-210d4e208d89"; // Dummy session id sementara
    const { productId, storeId, quantity } = req.body;
    const item = await cartService.addToCartService(userId, productId, storeId, Number(quantity));
    res.status(200).json({ message: "Barang berhasil masuk keranjang", data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { quantity } = req.body;
    const updated = await cartService.updateCartItemQtyService(id, Number(quantity));
    res.status(200).json({ message: "Jumlah item diperbarui", data: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await cartService.deleteCartItemService(id);
    res.status(200).json({ message: "Item dihapus dari keranjang" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = "c2ab071d-03b2-4343-a842-210d4e208d89";
    const cartData = await cartService.getUserCartService(userId);
    res.status(200).json(cartData || { items: [] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};