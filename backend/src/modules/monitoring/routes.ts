import { Router } from 'express';
import { listRecords, createRecord } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listRecords);
router.post('/', authenticate, createRecord);

export default router;
