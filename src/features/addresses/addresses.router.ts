import { Router } from 'express';
import * as addressController from './addresses.controller';

const router = Router();

router.post('/', addressController.createAddress);
router.get('/', addressController.getUserAddresses);
router.patch('/:id', addressController.updateAddress);

export default router;