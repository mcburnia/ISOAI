import { Router } from 'express';
import { listIncidents, getIncident, createIncident, updateIncident } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listIncidents);
router.get('/:id', authenticate, getIncident);
router.post('/', authenticate, createIncident);
router.patch('/:id', authenticate, updateIncident);

export default router;
