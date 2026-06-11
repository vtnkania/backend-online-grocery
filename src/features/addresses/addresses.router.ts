import { Router } from 'express';
import * as addressController from './addresses.controller';

const router = Router();

router.post('/', addressController.createAddress);
router.get('/', addressController.getUserAddresses);

export default router;