import { Router } from 'express';
import {
  listObligations, getObligation, createObligation, updateObligation,
  completeInstance, skipInstance, getSchedulingSummary,
} from './controller';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.use(authenticate);

router.get('/obligations', listObligations);
router.get('/obligations/:id', getObligation);
router.post('/obligations', requireAdmin, createObligation);
router.patch('/obligations/:id', requireAdmin, updateObligation);

router.post('/instances/:id/complete', requireComplianceUser, completeInstance);
router.post('/instances/:id/skip', requireAdmin, skipInstance);

router.get('/summary', getSchedulingSummary);

export default router;
