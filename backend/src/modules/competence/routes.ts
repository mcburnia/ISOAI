import { Router } from 'express';
import { getPendingCheck, submitAnswer, getHistory, getDashboard } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.use(authenticate);

router.get('/pending', getPendingCheck);
router.post('/answer', requireComplianceUser, submitAnswer);
router.get('/history', getHistory);
router.get('/dashboard', requireAdmin, getDashboard);

export default router;
