import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/brand.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/stats', requirePermission(PERMISSIONS.PRODUCT_READ), controller.getBrandStats);
router.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), controller.listBrands);
router.post('/', requirePermission(PERMISSIONS.BRAND_WRITE), controller.createBrand);
router.put('/:brandId', requirePermission(PERMISSIONS.BRAND_WRITE), controller.updateBrand);
router.delete('/:brandId', requirePermission(PERMISSIONS.BRAND_WRITE), controller.deleteBrand);

export default router;
