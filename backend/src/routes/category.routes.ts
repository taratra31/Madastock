import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as categoryController from '../controllers/category.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', categoryController.listCategories);
router.post('/', categoryController.createCategory);
router.put('/:categoryId', categoryController.updateCategory);
router.delete('/:categoryId', categoryController.deleteCategory);

export default router;