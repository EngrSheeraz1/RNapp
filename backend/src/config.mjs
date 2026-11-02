import path from 'node:path';

export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || env.JWT_SECRET.startsWith('replace-')) {
    throw new Error('Set JWT_SECRET to at least 32 random characters. Run npm run setup first.');
  }
  const devLogResetCodes = !production && env.DEV_LOG_RESET_CODES === 'true';
  const smtp = env.SMTP_HOST ? {
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  } : null;
  if (production && (!smtp || !env.SMTP_FROM)) throw new Error('Production requires SMTP_HOST and SMTP_FROM.');
  if (!smtp && !devLogResetCodes) throw new Error('Configure SMTP or enable DEV_LOG_RESET_CODES in development.');
  const sessionDays = Number(env.SESSION_DAYS || 7);
  if (!Number.isFinite(sessionDays) || sessionDays < 1 || sessionDays > 30) throw new Error('SESSION_DAYS must be between 1 and 30.');
  return {
    production, secret: env.JWT_SECRET, host: env.HOST || '0.0.0.0', port: Number(env.PORT || 3001),
    databasePath: path.resolve(env.DATABASE_PATH || './data/auth.sqlite'), sessionSeconds: Math.floor(sessionDays * 86400),
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    devLogResetCodes, smtp, smtpFrom: env.SMTP_FROM,
    googleClientId: env.GOOGLE_WEB_CLIENT_ID,
    facebookAppId: env.FACEBOOK_APP_ID, facebookAppSecret: env.FACEBOOK_APP_SECRET,
    facebookGraphVersion: env.FACEBOOK_GRAPH_VERSION || 'v24.0',
  };
}
