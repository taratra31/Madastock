import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as controller from '../controllers/supplier.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/stats', controller.getSupplierStats);
router.get('/', controller.listSuppliers);
router.get('/:supplierId', controller.getSupplier);
router.post('/', controller.createSupplier);
router.put('/:supplierId', controller.updateSupplier);
router.delete('/:supplierId', controller.deleteSupplier);

export default router;
