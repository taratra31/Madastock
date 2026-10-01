import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as invoiceController from '../controllers/invoice.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', requirePermission(PERMISSIONS.INVOICE_READ), invoiceController.listInvoices);
router.get('/:invoiceId', requirePermission(PERMISSIONS.INVOICE_READ), invoiceController.getInvoice);
router.post('/', requirePermission(PERMISSIONS.INVOICE_WRITE), invoiceController.createInvoice);
router.put('/:invoiceId', requirePermission(PERMISSIONS.INVOICE_WRITE), invoiceController.updateInvoice);
router.patch('/:invoiceId/status', requirePermission(PERMISSIONS.INVOICE_WRITE), invoiceController.changeStatus);
router.post('/:invoiceId/accept', requirePermission(PERMISSIONS.INVOICE_WRITE), invoiceController.acceptAndInvoice);
router.post('/:invoiceId/pay', requirePermission(PERMISSIONS.INVOICE_WRITE), invoiceController.recordPayment);
router.delete(
  '/:invoiceId',
  requirePermission(PERMISSIONS.INVOICE_DELETE),
  invoiceController.deleteInvoice,
);

export default router;
