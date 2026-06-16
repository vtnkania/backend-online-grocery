import { Router } from 'express';
import * as catalogController from './catalog.controller';

const router = Router();

router.get('/stores/default-location', catalogController.getDefaultStoreLocation);
router.get('/categories', catalogController.getCategories);
router.get('/products/:slug', catalogController.getProductBySlug);
router.get('/products', catalogController.getProducts);

export default router;
