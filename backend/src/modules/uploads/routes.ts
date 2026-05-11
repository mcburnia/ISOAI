import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';
import { upload, uploadFile, deleteFile } from './controller';

const router = Router();

router.post('/', authenticate, requireComplianceUser, upload.single('file'), uploadFile);
router.delete('/:filename', authenticate, requireComplianceUser, deleteFile);

export default router;
