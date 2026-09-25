import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as controller from '../controllers/purchase.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/stats', controller.getPurchaseStats);
router.get('/', controller.listPurchases);
router.post('/', controller.createPurchase);
router.get('/:purchaseId', controller.getPurchase);
router.patch('/:purchaseId/status', controller.setPurchaseStatus);
router.delete('/:purchaseId', controller.deletePurchase);

export default router;
