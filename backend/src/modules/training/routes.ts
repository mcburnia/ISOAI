import { Router } from 'express';
import { listRecords, createRecord, listModules, getModule, completeModule, getMyCompletion } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

// Training records
router.get('/', authenticate, listRecords);
router.post('/', authenticate, requireComplianceUser, createRecord);

// Training modules
router.get('/modules', authenticate, listModules);
router.get('/modules/:slug', authenticate, getModule);
router.post('/modules/:slug/complete', authenticate, requireComplianceUser, completeModule);
router.get('/modules/:slug/my-completion', authenticate, getMyCompletion);

export default router;
