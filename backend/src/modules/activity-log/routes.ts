import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { listActivityLogs } from './controller';

const router = Router();

router.get('/', authenticate, listActivityLogs);

export default router;
