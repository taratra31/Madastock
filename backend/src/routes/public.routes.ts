import { Router } from 'express';
import * as publicController from '../controllers/public.controller';

const router = Router();

router.get('/stores/:slug', publicController.getStoreInfo);
router.get('/catalogue/:slug', publicController.getCatalogue);

export default router;
