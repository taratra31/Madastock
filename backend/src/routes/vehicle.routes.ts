import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as vehicleController from '../controllers/vehicle.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite, requirePermission(PERMISSIONS.CRM_READ));

const needWrite = requirePermission(PERMISSIONS.CRM_WRITE);

router.get('/', vehicleController.listVehicles);
router.get('/:vehicleId', vehicleController.getVehicle);
router.post('/', needWrite, vehicleController.createVehicle);
router.put('/:vehicleId', needWrite, vehicleController.updateVehicle);
router.delete('/:vehicleId', needWrite, vehicleController.deleteVehicle);

export default router;
