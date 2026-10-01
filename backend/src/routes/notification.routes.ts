import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/notification.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', requirePermission(PERMISSIONS.NOTIFICATION_READ), controller.list);
router.get('/unread', requirePermission(PERMISSIONS.NOTIFICATION_READ), controller.unread);
router.patch('/read-all', requirePermission(PERMISSIONS.NOTIFICATION_READ), controller.readAll);
router.patch(
  '/:notificationId/read',
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  controller.read,
);
router.delete(
  '/:notificationId',
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  controller.remove,
);

export default router;
