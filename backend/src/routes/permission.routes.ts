import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { asyncHandler } from '../utils/asyncHandler';
import { permissionsFor } from '../lib/permissions';

const router = Router();

/**
 * Permissions du membre courant : le frontend s'en sert pour masquer
 * les actions interdites (le vrai contrôle reste côté serveur).
 */
router.get('/', authenticate, requireStoreAccess, asyncHandler(async (req, res) => {
  res.json({
    role: req.store?.role ?? null,
    isOwner: req.store?.isOwner ?? false,
    permissions: permissionsFor(req.store?.role, req.store?.isOwner ?? false),
  });
}));

export default router;
