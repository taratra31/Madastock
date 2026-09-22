import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as customerController from '../controllers/customer.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', customerController.listCustomers);
router.get('/stats', customerController.getCustomerStats);
router.get('/:customerId', customerController.getCustomer);
router.post('/', customerController.createCustomer);
router.put('/:customerId', customerController.updateCustomer);
router.delete('/:customerId', customerController.deleteCustomer);

export default router;