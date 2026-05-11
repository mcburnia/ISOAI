import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { chat, status } from './controller';

const router = Router();

router.get('/status', authenticate, status);
router.post('/chat', authenticate, chat);

export default router;
