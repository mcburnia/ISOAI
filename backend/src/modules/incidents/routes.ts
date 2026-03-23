import { Router } from 'express';
import { listIncidents, getIncident, createIncident, updateIncident } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listIncidents);
router.get('/:id', authenticate, getIncident);
router.post('/', authenticate, requireComplianceUser, createIncident);
router.patch('/:id', authenticate, requireComplianceUser, updateIncident);

export default router;
