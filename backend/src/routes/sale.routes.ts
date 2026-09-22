import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as saleController from '../controllers/sale.controller';

const router = Router();

router.use(authenticate);
router.use(requireStoreAccess);

router.get('/', saleController.listSales);
router.post('/', saleController.createSale);
router.get('/:saleId', saleController.getSale);
router.post('/:saleId/cancel', saleController.cancelSale);

export default router;
