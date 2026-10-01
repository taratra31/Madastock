import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/supplier.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/stats', requirePermission(PERMISSIONS.SUPPLIER_READ), controller.getSupplierStats);
router.get('/', requirePermission(PERMISSIONS.SUPPLIER_READ), controller.listSuppliers);
router.get('/:supplierId', requirePermission(PERMISSIONS.SUPPLIER_READ), controller.getSupplier);
router.post('/', requirePermission(PERMISSIONS.SUPPLIER_WRITE), controller.createSupplier);
router.put('/:supplierId', requirePermission(PERMISSIONS.SUPPLIER_WRITE), controller.updateSupplier);
router.delete('/:supplierId', requirePermission(PERMISSIONS.SUPPLIER_WRITE), controller.deleteSupplier);

export default router;
