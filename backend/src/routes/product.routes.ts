import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as productController from '../controllers/product.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', productController.listProducts);
router.get('/:productId', productController.getProduct);
router.post('/', productController.createProduct);
router.put('/:productId', productController.updateProduct);
router.delete('/:productId', productController.deleteProduct);

export default router;