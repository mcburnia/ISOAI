import { Router } from 'express';
import { register, login, me, changePassword, updateProfile, forceChangePassword } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);
router.post('/force-change-password', authenticate, forceChangePassword);
router.patch('/profile', authenticate, updateProfile);

export default router;
