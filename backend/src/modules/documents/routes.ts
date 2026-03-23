import { Router } from 'express';
import { listDocuments, getDocument, updateDocument } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listDocuments);
router.get('/:slug', authenticate, getDocument);
router.patch('/:id', authenticate, requireComplianceUser, updateDocument);

export default router;
