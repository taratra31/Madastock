import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as vehicleController from '../controllers/vehicle.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', vehicleController.listVehicles);
router.get('/:vehicleId', vehicleController.getVehicle);
router.post('/', vehicleController.createVehicle);
router.put('/:vehicleId', vehicleController.updateVehicle);
router.delete('/:vehicleId', vehicleController.deleteVehicle);

export default router;