import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as categoryController from '../controllers/category.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), categoryController.listCategories);
router.post(
  '/',
  requirePermission(PERMISSIONS.CATEGORY_WRITE),
  categoryController.createCategory,
);
router.put(
  '/:categoryId',
  requirePermission(PERMISSIONS.CATEGORY_WRITE),
  categoryController.updateCategory,
);
router.delete(
  '/:categoryId',
  requirePermission(PERMISSIONS.CATEGORY_WRITE),
  categoryController.deleteCategory,
);

export default router;
