import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as appointmentController from '../controllers/appointment.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite, requirePermission(PERMISSIONS.CRM_READ));

const needWrite = requirePermission(PERMISSIONS.CRM_WRITE);

router.get('/', appointmentController.listAppointments);
router.get('/:appointmentId', appointmentController.getAppointment);
router.post('/', needWrite, appointmentController.createAppointment);
router.put('/:appointmentId', needWrite, appointmentController.updateAppointment);
router.patch('/:appointmentId/status', needWrite, appointmentController.changeStatus);
router.delete('/:appointmentId', needWrite, appointmentController.deleteAppointment);

export default router;
