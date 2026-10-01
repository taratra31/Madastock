import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as stockController from '../controllers/stock.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.STOCK_READ), stockController.listStock);
router.get('/movements', requirePermission(PERMISSIONS.STOCK_READ), stockController.listMovements);
router.post('/adjust', requirePermission(PERMISSIONS.STOCK_WRITE), stockController.adjustStock);
router.get('/warehouses', requirePermission(PERMISSIONS.STOCK_READ), stockController.listWarehouses);

export default router;
