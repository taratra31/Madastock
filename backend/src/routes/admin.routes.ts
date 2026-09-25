import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/admin';
import * as adminController from '../controllers/admin.controller';
import { requestWhatsappQr, whatsappStatus } from '../services/whatsapp.service';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/whatsapp', (_req, res) => {
  res.json(whatsappStatus());
});

router.get('/whatsapp/qr', (_req, res) => {
  res.json(requestWhatsappQr());
});

router.get('/overview', adminController.getOverview);

router.get('/stores', adminController.listStores);
router.patch('/stores/:storeId', adminController.setStoreStatus);

router.get('/users', adminController.listUsers);
router.patch('/users/:userId', adminController.setUserStatus);

router.get('/subscriptions', adminController.listSubscriptions);
router.patch('/subscriptions/:subscriptionId', adminController.updateSubscription);

router.get('/payments', adminController.listPayments);

export default router;