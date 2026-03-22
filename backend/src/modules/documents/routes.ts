import { Router } from 'express';
import { listDocuments, getDocument, updateDocument } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listDocuments);
router.get('/:slug', authenticate, getDocument);
router.patch('/:id', authenticate, updateDocument);

export default router;
