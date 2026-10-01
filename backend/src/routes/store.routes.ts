import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess, requireOwnerOrAdmin, requireOwner } from '../middleware/store';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as storeController from '../controllers/store.controller';

const router = Router();

// CRUD boutiques
router.post('/', authenticate, storeController.createStore);
router.get('/', authenticate, storeController.listStores);

// Routes scopées par boutique via l'en-tête X-Store-Id
router.get('/me', authenticate, requireStoreAccess, storeController.getStore);
router.put(
  '/me',
  authenticate,
  requireStoreAccess,
  requireOwnerOrAdmin,
  requirePermission(PERMISSIONS.SETTINGS_WRITE),
  storeController.updateStore,
);
router.delete('/me', authenticate, requireStoreAccess, requireOwner, storeController.deleteStore);

// Gestion des membres de la boutique courante
router.get('/members', authenticate, requireStoreAccess, requirePermission(PERMISSIONS.MEMBER_MANAGE), storeController.listMembers);
router.post(
  '/members',
  authenticate,
  requireStoreAccess,
  requireOwnerOrAdmin,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  storeController.addMember,
);
router.put(
  '/members/:memberId',
  authenticate,
  requireStoreAccess,
  requireOwner,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  storeController.updateMember,
);
router.delete(
  '/members/:memberId',
  authenticate,
  requireStoreAccess,
  requireOwnerOrAdmin,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  storeController.removeMember,
);

export default router;
