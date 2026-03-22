export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@isoai.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  // Deployment mode: saas | dedicated | onpremise
  deploymentMode: (process.env.DEPLOYMENT_MODE || 'saas') as 'saas' | 'dedicated' | 'onpremise',
  // Default tenant slug for single-tenant / on-premise deployments
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'default',
  // SMTP configuration
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@isoai.local',
  appUrl: process.env.APP_URL || 'http://localhost:5174',
};
