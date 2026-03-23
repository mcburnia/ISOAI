import { Router } from 'express';
import {
  listAudits, getAudit, createAudit, updateAudit,
  createFinding, updateFinding,
  listReviews, createReview, getReview,
} from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listAudits);
router.get('/:id', authenticate, getAudit);
router.post('/', authenticate, requireComplianceUser, createAudit);
router.patch('/:id', authenticate, requireComplianceUser, updateAudit);

router.post('/:auditId/findings', authenticate, requireComplianceUser, createFinding);
router.patch('/findings/:id', authenticate, requireComplianceUser, updateFinding);

router.get('/management-reviews', authenticate, listReviews);
router.get('/management-reviews/:id', authenticate, getReview);
router.post('/management-reviews', authenticate, requireComplianceUser, createReview);

export default router;
