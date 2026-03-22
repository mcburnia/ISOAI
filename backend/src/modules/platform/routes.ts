import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import {
  createTenantHandler,
  listTenantsHandler,
  getTenantHandler,
  updateTenantHandler,
  listStandardsHandler,
  activateStandardHandler,
  getTenantStandardsHandler,
} from './controller';

const router = Router();

// All platform routes require authentication + super admin role
router.use(authenticate);
router.use(requireSuperAdmin);

// Tenant CRUD
router.get('/tenants', listTenantsHandler);
router.post('/tenants', createTenantHandler);
router.get('/tenants/:id', getTenantHandler);
router.patch('/tenants/:id', updateTenantHandler);

// Standards
router.get('/standards', listStandardsHandler);

// Tenant-Standard activation
router.get('/tenants/:tenantId/standards', getTenantStandardsHandler);
router.post('/tenants/:tenantId/standards', activateStandardHandler);

export default router;
