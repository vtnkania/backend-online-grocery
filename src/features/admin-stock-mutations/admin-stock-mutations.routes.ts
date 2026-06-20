import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import * as controller from './admin-stock-mutations.controller';

const router = Router();
const adminAccess = requireRole('SUPER_ADMIN', 'STORE_ADMIN');

router.use(authenticateUser);
router.get('/stores', adminAccess, controller.listStores);
router.get('/', adminAccess, controller.listMutations);
router.post('/', adminAccess, controller.requestMutation);
router.patch('/:id/accept', adminAccess, controller.acceptMutation);
router.patch('/:id/reject', adminAccess, controller.rejectMutation);
router.patch('/:id/ship', adminAccess, controller.shipMutation);
router.patch('/:id/receive', adminAccess, controller.receiveMutation);

export default router;
