import { Router } from 'express';
import { listRisks, getRisk, createRisk, updateRisk, deleteRisk } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listRisks);
router.get('/:id', authenticate, getRisk);
router.post('/', authenticate, createRisk);
router.patch('/:id', authenticate, updateRisk);
router.delete('/:id', authenticate, deleteRisk);

export default router;
