import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as reminderController from '../controllers/reminder.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite, requirePermission(PERMISSIONS.CRM_READ));

const needWrite = requirePermission(PERMISSIONS.CRM_WRITE);

router.get('/', reminderController.listReminders);
router.post('/', needWrite, reminderController.createReminder);
router.put('/:reminderId', needWrite, reminderController.updateReminder);
router.patch('/:reminderId/status', needWrite, reminderController.changeStatus);
router.delete('/:reminderId', needWrite, reminderController.deleteReminder);

export default router;
