import { Router } from 'express';
import { listRecords, createRecord, listModules, getModule, completeModule, getMyCompletion } from './controller';
import {
  listQuestions, createQuestion, updateQuestion, deleteQuestion,
  updatePassThreshold, submitAssessment, listMyAttempts,
} from './assessmentController';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

// Training records
router.get('/', authenticate, listRecords);
router.post('/', authenticate, requireComplianceUser, createRecord);

// Training modules
router.get('/modules', authenticate, listModules);
router.get('/modules/:slug', authenticate, getModule);
router.post('/modules/:slug/complete', authenticate, requireComplianceUser, completeModule);
router.get('/modules/:slug/my-completion', authenticate, getMyCompletion);

// Assessment questions (admin manages, all can view)
router.get('/modules/:slug/questions', authenticate, listQuestions);
router.post('/modules/:slug/questions', authenticate, requireAdmin, createQuestion);
router.patch('/modules/:slug/questions/:questionId', authenticate, requireAdmin, updateQuestion);
router.delete('/modules/:slug/questions/:questionId', authenticate, requireAdmin, deleteQuestion);

// Pass threshold (admin only)
router.patch('/modules/:slug/pass-threshold', authenticate, requireAdmin, updatePassThreshold);

// Assessment submission
router.post('/modules/:slug/assess', authenticate, requireComplianceUser, submitAssessment);
router.get('/modules/:slug/my-attempts', authenticate, listMyAttempts);

export default router;
