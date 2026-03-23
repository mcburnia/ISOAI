export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  adminEmail: process.env.ADMIN_EMAIL || 'support@keepmeiso.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'KeepMeIso@2026',
  // Deployment mode: saas | dedicated | onpremise
  deploymentMode: (process.env.DEPLOYMENT_MODE || 'saas') as 'saas' | 'dedicated' | 'onpremise',
  // Default tenant slug for single-tenant / on-premise deployments
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'default',
  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'support@post.keepmeiso.com',
  appUrl: process.env.APP_URL || 'https://keepmeiso.com',
};
