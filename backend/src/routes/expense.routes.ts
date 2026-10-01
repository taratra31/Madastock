import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/expense.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/stats', requirePermission(PERMISSIONS.EXPENSE_READ), controller.getExpenseStats);
router.get('/', requirePermission(PERMISSIONS.EXPENSE_READ), controller.listExpenses);
router.post('/', requirePermission(PERMISSIONS.EXPENSE_WRITE), controller.createExpense);
router.put('/:expenseId', requirePermission(PERMISSIONS.EXPENSE_WRITE), controller.updateExpense);
router.delete('/:expenseId', requirePermission(PERMISSIONS.EXPENSE_WRITE), controller.deleteExpense);

export default router;
