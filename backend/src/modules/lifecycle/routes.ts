import { Router } from 'express';
import { listEntries, createEntry, updateEntry, initLifecycle } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listEntries);
router.post('/', authenticate, requireComplianceUser, createEntry);
router.post('/init/:systemId', authenticate, requireComplianceUser, initLifecycle);
router.patch('/:id', authenticate, requireComplianceUser, updateEntry);

export default router;
