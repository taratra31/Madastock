import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/purchase.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/stats', requirePermission(PERMISSIONS.PURCHASE_READ), controller.getPurchaseStats);
router.get('/', requirePermission(PERMISSIONS.PURCHASE_READ), controller.listPurchases);
router.post('/', requirePermission(PERMISSIONS.PURCHASE_WRITE), controller.createPurchase);
router.get('/:purchaseId', requirePermission(PERMISSIONS.PURCHASE_READ), controller.getPurchase);
router.patch(
  '/:purchaseId/status',
  // Changer le statut = réception (entrée en stock) ou annulation.
  requirePermission(PERMISSIONS.PURCHASE_RECEIVE),
  controller.setPurchaseStatus,
);
router.delete('/:purchaseId', requirePermission(PERMISSIONS.PURCHASE_WRITE), controller.deletePurchase);

export default router;
