import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as stockController from '../controllers/stock.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', stockController.listStock);
router.post('/adjust', stockController.adjustStock);
router.get('/warehouses', stockController.listWarehouses);

export default router;