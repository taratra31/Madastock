import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as productController from '../controllers/product.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), productController.listProducts);
router.get('/:productId', requirePermission(PERMISSIONS.PRODUCT_READ), productController.getProduct);
router.post('/', requirePermission(PERMISSIONS.PRODUCT_WRITE), productController.createProduct);
router.put('/:productId', requirePermission(PERMISSIONS.PRODUCT_WRITE), productController.updateProduct);
router.delete(
  '/:productId',
  requirePermission(PERMISSIONS.PRODUCT_DELETE),
  productController.deleteProduct,
);

export default router;
