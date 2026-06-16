import { Router } from 'express';
import * as orderController from './orders.controller'; // <-- Ganti baris 2 jadi ini!

const router = Router();

router.post('/', orderController.createOrder); // <-- Sesuaikan panggilannya jadi begini
router.get('/', orderController.getUserOrdersHistory);
router.patch('/complete', orderController.completeOrder);
// PATCH /api/v1/orders/cancel
router.patch('/cancel', orderController.cancelOrder);

export default router;