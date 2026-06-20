import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import * as controller from './admin-stores.controller';

const router = Router();
const superAccess = requireRole('SUPER_ADMIN');

router.use(authenticateUser);
router.get('/managers', superAccess, controller.listManagers);
router.get('/', superAccess, controller.listStores);
router.get('/:id', superAccess, controller.getStore);
router.post('/', superAccess, controller.createStore);
router.patch('/:id', superAccess, controller.updateStore);
router.delete('/:id', superAccess, controller.deleteStore);

export default router;
