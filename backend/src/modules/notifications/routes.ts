import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { listNotifications, markRead, markAllRead } from './controller';

const router = Router();

router.get('/', authenticate, listNotifications);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);

export default router;
