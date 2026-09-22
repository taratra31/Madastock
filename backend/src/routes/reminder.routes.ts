import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as reminderController from '../controllers/reminder.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', reminderController.listReminders);
router.post('/', reminderController.createReminder);
router.put('/:reminderId', reminderController.updateReminder);
router.patch('/:reminderId/status', reminderController.changeStatus);
router.delete('/:reminderId', reminderController.deleteReminder);

export default router;