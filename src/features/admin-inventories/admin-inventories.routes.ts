import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import * as controller from './admin-inventories.controller';

const router = Router();
const readAccess = requireRole('SUPER_ADMIN', 'STORE_ADMIN');
const writeAccess = requireRole('SUPER_ADMIN');

router.use(authenticateUser);
router.get('/', readAccess, controller.listInventories);
router.get('/:id/mutations', readAccess, controller.listMutations);
router.post('/', writeAccess, controller.createInventory);
router.patch('/:id/stock', writeAccess, controller.updateStock);
router.delete('/:id', writeAccess, controller.deleteInventory);

export default router;
