import { Router } from 'express';
import { listRisks, getRisk, createRisk, updateRisk, deleteRisk } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listRisks);
router.get('/:id', authenticate, getRisk);
router.post('/', authenticate, requireComplianceUser, createRisk);
router.patch('/:id', authenticate, requireComplianceUser, updateRisk);
router.delete('/:id', authenticate, requireComplianceUser, deleteRisk);

export default router;
