import { Router } from 'express';
import { authenticateUser, requireRole } from '@/middlewares/auth.middleware';
import { productImageUpload } from './admin-product-upload';
import * as controller from './admin-products.controller';

const router = Router();
const readAccess = requireRole('SUPER_ADMIN', 'STORE_ADMIN');
const writeAccess = requireRole('SUPER_ADMIN');
const uploadImages = productImageUpload.array('images', 8);

router.use(authenticateUser);
router.get('/', readAccess, controller.listProducts);
router.get('/options', readAccess, controller.getProductOptions);
router.get('/:id', readAccess, controller.getProduct);
router.post('/', writeAccess, uploadImages, controller.createProduct);
router.patch('/:id', writeAccess, uploadImages, controller.updateProduct);
router.delete('/:id', writeAccess, controller.deleteProduct);

export default router;
