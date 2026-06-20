import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import * as controller from './admin-users.controller';

const router = Router();
const superAccess = requireRole('SUPER_ADMIN');

router.use(authenticateUser);
router.get('/', superAccess, controller.listUsers);
router.patch('/:id/role', superAccess, controller.updateUserRole);
router.delete('/:id', superAccess, controller.deleteUser);

export default router;
