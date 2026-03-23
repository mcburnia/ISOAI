import { Router } from 'express';
import { listStandards, listMappings, updateMapping, getDashboard } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/standards', authenticate, listStandards);
router.get('/dashboard', authenticate, getDashboard);
router.get('/', authenticate, listMappings);
router.patch('/:id', authenticate, requireComplianceUser, updateMapping);

export default router;
