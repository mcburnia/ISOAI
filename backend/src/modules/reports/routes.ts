import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { complianceReportPdf, controlMappingCsv, trainingRecordsCsv, soaPdf } from './controller';

const router = Router();

router.get('/compliance-report.pdf', authenticate, complianceReportPdf);
router.get('/control-mapping.csv', authenticate, controlMappingCsv);
router.get('/training-records.csv', authenticate, trainingRecordsCsv);
router.get('/soa.pdf', authenticate, soaPdf);

export default router;
