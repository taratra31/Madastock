import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as controller from '../controllers/brand.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/stats', controller.getBrandStats);
router.get('/', controller.listBrands);
router.post('/', controller.createBrand);
router.put('/:brandId', controller.updateBrand);
router.delete('/:brandId', controller.deleteBrand);

export default router;
