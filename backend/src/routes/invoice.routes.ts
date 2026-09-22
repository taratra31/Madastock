import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as invoiceController from '../controllers/invoice.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', invoiceController.listInvoices);
router.get('/:invoiceId', invoiceController.getInvoice);
router.post('/', invoiceController.createInvoice);
router.put('/:invoiceId', invoiceController.updateInvoice);
router.patch('/:invoiceId/status', invoiceController.changeStatus);
router.post('/:invoiceId/accept', invoiceController.acceptAndInvoice);
router.post('/:invoiceId/pay', invoiceController.recordPayment);
router.delete('/:invoiceId', invoiceController.deleteInvoice);

export default router;