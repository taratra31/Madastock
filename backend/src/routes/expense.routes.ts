import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import * as controller from '../controllers/expense.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/stats', controller.getExpenseStats);
router.get('/', controller.listExpenses);
router.post('/', controller.createExpense);
router.put('/:expenseId', controller.updateExpense);
router.delete('/:expenseId', controller.deleteExpense);

export default router;
