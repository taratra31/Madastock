import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import * as saleController from '../controllers/sale.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', saleController.listSales);
router.post('/', saleController.createSale);
router.get('/:saleId', saleController.getSale);
router.post('/:saleId/cancel', saleController.cancelSale);

export default router;
