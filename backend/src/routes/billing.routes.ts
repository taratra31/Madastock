import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as billingController from '../controllers/billing.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', billingController.getBilling);
router.post('/checkout', billingController.createCheckout);
router.post('/:orderId/refresh', billingController.refreshOrder);
router.get('/reference/:reference/status', billingController.getPaymentStatus);

export default router;