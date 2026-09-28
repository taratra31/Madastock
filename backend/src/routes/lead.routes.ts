import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import * as leadController from '../controllers/lead.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/funnel', leadController.getLeadFunnel);
router.get('/', leadController.listLeads);
router.get('/:leadId', leadController.getLead);
router.post('/', leadController.createLead);
router.put('/:leadId', leadController.updateLead);
router.patch('/:leadId/status', leadController.changeStatus);
router.post('/:leadId/convert', leadController.convertLead);
router.delete('/:leadId', leadController.deleteLead);

export default router;