import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import * as workOrderController from '../controllers/workOrder.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', workOrderController.listWorkOrders);
router.get('/:workOrderId', workOrderController.getWorkOrder);
router.post('/', workOrderController.createWorkOrder);
router.put('/:workOrderId', workOrderController.updateWorkOrder);
router.patch('/:workOrderId/status', workOrderController.changeStatus);
router.delete('/:workOrderId', workOrderController.deleteWorkOrder);

export default router;