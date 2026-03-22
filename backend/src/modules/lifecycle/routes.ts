import { Router } from 'express';
import { listEntries, createEntry, updateEntry, initLifecycle } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listEntries);
router.post('/', authenticate, createEntry);
router.post('/init/:systemId', authenticate, initLifecycle);
router.patch('/:id', authenticate, updateEntry);

export default router;
