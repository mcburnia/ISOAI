import { Router } from 'express';
import { createUser, listUsers, getUser, updateUserRole } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';

const router = Router();

router.post('/', authenticate, requireAdmin, createUser);
router.get('/', authenticate, listUsers);
router.get('/:id', authenticate, getUser);
router.patch('/:id/role', authenticate, requireAdmin, updateUserRole);

export default router;
