import { Router } from 'express';
import * as shippingController from './shippings.controller';

const router = Router();

router.post('/rates', shippingController.calculateRates);
router.patch('/ship', shippingController.shipOrder);

export default router;