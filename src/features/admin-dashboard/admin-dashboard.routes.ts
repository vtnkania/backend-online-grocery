import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import * as controller from './admin-dashboard.controller';

const router = Router();
const adminAccess = requireRole('SUPER_ADMIN', 'STORE_ADMIN');

router.use(authenticateUser);
router.get('/', adminAccess, controller.getDashboard);

export default router;
