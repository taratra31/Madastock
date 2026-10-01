import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as warehouseController from '../controllers/warehouse.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.STOCK_READ), warehouseController.listWarehouses);
router.post('/', requirePermission(PERMISSIONS.WAREHOUSE_MANAGE), warehouseController.createWarehouse);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.WAREHOUSE_MANAGE),
  warehouseController.updateWarehouse,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.WAREHOUSE_MANAGE),
  warehouseController.deleteWarehouse,
);

/// Transférer du stock d'un dépôt vers un autre (une opération, deux mouvements).
router.post('/transfers', requirePermission(PERMISSIONS.STOCK_WRITE), warehouseController.transferStock);

export default router;
