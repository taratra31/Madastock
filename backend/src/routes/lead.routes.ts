import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as leadController from '../controllers/lead.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite, requirePermission(PERMISSIONS.CRM_READ));

const needWrite = requirePermission(PERMISSIONS.CRM_WRITE);

router.get('/funnel', leadController.getLeadFunnel);
router.get('/', leadController.listLeads);
router.get('/:leadId', leadController.getLead);
router.post('/', needWrite, leadController.createLead);
router.put('/:leadId', needWrite, leadController.updateLead);
router.patch('/:leadId/status', needWrite, leadController.changeStatus);
router.post('/:leadId/convert', needWrite, leadController.convertLead);
router.delete('/:leadId', needWrite, leadController.deleteLead);

export default router;
