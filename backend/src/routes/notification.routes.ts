import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as controller from '../controllers/notification.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', controller.list);
router.get('/unread', controller.unread);
router.patch('/read-all', controller.readAll);
router.patch('/:notificationId/read', controller.read);
router.delete('/:notificationId', controller.remove);

export default router;
