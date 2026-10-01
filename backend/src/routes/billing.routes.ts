import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as billingController from '../controllers/billing.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

// Consulter son abonnement : autorisé à tout membre (l'écran reste visible
// même quand tout le reste est verrouillé).
router.get('/', billingController.getBilling);

// Payer : réservé au propriétaire (c'est sa carte, sa boutique).
router.post(
  '/checkout',
  requirePermission(PERMISSIONS.BILLING_WRITE),
  billingController.createCheckout,
);
router.post(
  '/:orderId/refresh',
  requirePermission(PERMISSIONS.BILLING_WRITE),
  billingController.refreshOrder,
);
router.get('/reference/:reference/status', billingController.getPaymentStatus);

export default router;
