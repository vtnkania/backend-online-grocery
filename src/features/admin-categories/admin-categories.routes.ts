import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import * as controller from './admin-categories.controller';

const router = Router();
const superAccess = requireRole('SUPER_ADMIN');

router.use(authenticateUser);
router.get('/', superAccess, controller.listCategories);
router.post('/', superAccess, controller.createCategory);
router.patch('/:id', superAccess, controller.updateCategory);
router.delete('/:id', superAccess, controller.deleteCategory);

export default router;
