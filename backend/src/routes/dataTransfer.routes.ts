import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/dataTransfer.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

// ---- Exports (le fichier revient en téléchargement) ----
router.get('/export/products', requirePermission(PERMISSIONS.DATA_EXPORT), controller.exportProducts);
router.get('/export/stock', requirePermission(PERMISSIONS.DATA_EXPORT), controller.exportStock);
router.get('/export/sales', requirePermission(PERMISSIONS.DATA_EXPORT), controller.exportSales);
router.get('/export/invoices', requirePermission(PERMISSIONS.DATA_EXPORT), controller.exportInvoices);
router.get('/import/template', requirePermission(PERMISSIONS.DATA_IMPORT), controller.importTemplate);

// ---- Imports ----
router.post('/import/products', requirePermission(PERMISSIONS.DATA_IMPORT), controller.importProducts);
router.post('/import/stock', requirePermission(PERMISSIONS.DATA_IMPORT), controller.importStock);

export default router;
