import { Router } from 'express';
import * as cartController from './carts.controller';

const router = Router();

router.post('/', cartController.addToCart);         // POST /api/carts (Add to Cart)
router.get('/', cartController.getUserCart);        // GET /api/carts (Get User Cart List)
router.patch('/:id', cartController.updateCartItem); // PATCH /api/carts/:id (Update Qty)
router.delete('/:id', cartController.deleteCartItem); // DELETE /api/carts/:id (Hapus Item)

export default router;