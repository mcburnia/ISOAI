import { Router } from 'express';
import {
  listAudits, getAudit, createAudit, updateAudit,
  createFinding, updateFinding,
  listReviews, createReview, getReview,
} from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listAudits);
router.get('/:id', authenticate, getAudit);
router.post('/', authenticate, createAudit);
router.patch('/:id', authenticate, updateAudit);

router.post('/:auditId/findings', authenticate, createFinding);
router.patch('/findings/:id', authenticate, updateFinding);

router.get('/management-reviews', authenticate, listReviews);
router.get('/management-reviews/:id', authenticate, getReview);
router.post('/management-reviews', authenticate, createReview);

export default router;
