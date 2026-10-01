import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/report.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

// La lecture des rapports reste possible même abonnement expiré (l'utilisateur
// doit pouvoir consulter ses chiffres avant de renouveler).
router.get('/sales', requirePermission(PERMISSIONS.REPORT_READ), controller.salesReport);
router.get('/rotation', requirePermission(PERMISSIONS.REPORT_READ), controller.rotationReport);
router.get('/products', requirePermission(PERMISSIONS.REPORT_READ), controller.productPerformance);

export default router;
