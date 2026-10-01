import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as saleController from '../controllers/sale.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.SALE_READ), saleController.listSales);
router.post('/', requirePermission(PERMISSIONS.SALE_CREATE), saleController.createSale);
router.get('/:saleId', requirePermission(PERMISSIONS.SALE_READ), saleController.getSale);
router.post(
  '/:saleId/cancel',
  requirePermission(PERMISSIONS.SALE_CANCEL),
  saleController.cancelSale,
);

export default router;
