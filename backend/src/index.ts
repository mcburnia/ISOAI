import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { disconnectAll } from './services/tenantManager';
import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import systemRoutes from './modules/systems/routes';
import riskRoutes from './modules/risks/routes';
import lifecycleRoutes from './modules/lifecycle/routes';
import incidentRoutes from './modules/incidents/routes';
import oversightRoutes from './modules/oversight/routes';
import monitoringRoutes from './modules/monitoring/routes';
import trainingRoutes from './modules/training/routes';
import auditRoutes from './modules/audits/routes';
import roleRoutes from './modules/roles/routes';
import complianceRoutes from './modules/compliance/routes';
import documentRoutes from './modules/documents/routes';
import activityLogRoutes from './modules/activity-log/routes';
import platformRoutes from './modules/platform/routes';
import settingsRoutes from './modules/settings/routes';

const app = express();

app.use(cors());
app.use(express.json());

// Tenant API routes (scoped to tenant via JWT schemaName)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/oversight', oversightRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/governance-roles', roleRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/activity-log', activityLogRoutes);

// Tenant settings routes (standard selection, org config)
app.use('/api/settings', settingsRoutes);

// Platform admin routes (tenant/standard management)
app.use('/api/platform', platformRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', deploymentMode: env.deploymentMode });
});

app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`ISOAI backend running on port ${env.port} (${env.deploymentMode} mode)`);
});

// Graceful shutdown — disconnect all Prisma clients
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await disconnectAll();
  server.close();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await disconnectAll();
  server.close();
});
