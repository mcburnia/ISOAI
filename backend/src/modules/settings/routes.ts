import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { listTenantStandards, activateStandard, deactivateStandard } from './controller';

const router = Router();

router.use(authenticate);

// All settings routes require admin role
router.get('/standards', requireAdmin, listTenantStandards);
router.post('/standards/:code/activate', requireAdmin, activateStandard);
router.post('/standards/:code/deactivate', requireAdmin, deactivateStandard);

export default router;
