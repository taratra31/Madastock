import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as customerController from '../controllers/customer.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.CUSTOMER_READ), customerController.listCustomers);
router.get('/stats', requirePermission(PERMISSIONS.CUSTOMER_READ), customerController.getCustomerStats);
router.get('/:customerId', requirePermission(PERMISSIONS.CUSTOMER_READ), customerController.getCustomer);
router.post('/', requirePermission(PERMISSIONS.CUSTOMER_WRITE), customerController.createCustomer);
router.put('/:customerId', requirePermission(PERMISSIONS.CUSTOMER_WRITE), customerController.updateCustomer);
router.delete(
  '/:customerId',
  requirePermission(PERMISSIONS.CUSTOMER_DELETE),
  customerController.deleteCustomer,
);

export default router;
