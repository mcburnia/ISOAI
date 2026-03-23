import { Router } from 'express';
import { listRecords, createRecord } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listRecords);
router.post('/', authenticate, requireComplianceUser, createRecord);

export default router;
