import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as appointmentController from '../controllers/appointment.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', appointmentController.listAppointments);
router.get('/:appointmentId', appointmentController.getAppointment);
router.post('/', appointmentController.createAppointment);
router.put('/:appointmentId', appointmentController.updateAppointment);
router.patch('/:appointmentId/status', appointmentController.changeStatus);
router.delete('/:appointmentId', appointmentController.deleteAppointment);

export default router;