import { Router } from 'express';
import * as paymentController from './payments.controller';

const router = Router();

// POST /api/v1/payments
router.post('/', paymentController.confirmPayment);

// PATCH /api/v1/payments/approve
router.patch('/approve', paymentController.approvePayment);

// POST /api/v1/payments/midtrans-notification
router.post('/midtrans-notification', paymentController.handleMidtransNotification);

// POST /api/v1/payments/qris
router.post('/qris', paymentController.createQrisPayment);

export default router;