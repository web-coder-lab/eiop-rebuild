import 'dotenv/config';

const bool = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

function requiredRange(name: string, raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return n;
}

const port = requiredRange('PORT', process.env.PORT, 3001, 1, 65535);
const privateApiTimeoutMs = requiredRange('PRIVATE_API_TIMEOUT_MS', process.env.PRIVATE_API_TIMEOUT_MS, 15000, 1000, 120000);
const paymentTimeoutMs = requiredRange('PAYMENT_GATEWAY_TIMEOUT_MS', process.env.PAYMENT_GATEWAY_TIMEOUT_MS, 15000, 1000, 120000);
const uploadMaxMb = requiredRange('PRIVATE_API_UPLOAD_MAX_MB', process.env.PRIVATE_API_UPLOAD_MAX_MB, 100, 1, 500);
const maxStreamStorageHours = requiredRange('MAX_STREAM_STORAGE_HOURS', process.env.MAX_STREAM_STORAGE_HOURS, 6, 1, 6);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  trustProxy: bool(process.env.TRUST_PROXY, false),
  corsOrigin: process.env.CORS_ORIGIN || '',
  clientDist: process.env.CLIENT_DIST || '../../web',
  logLevel: process.env.LOG_LEVEL || 'info',
  privateApiBaseUrl: (process.env.PRIVATE_API_BASE_URL || '').replace(/\/$/, ''),
  privateApiKey: process.env.PRIVATE_API_KEY || '',
  privateApiTimeoutMs,
  uploadMaxMb,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  paymentGatewayBaseUrl: (process.env.PAYMENT_GATEWAY_BASE_URL || '').replace(/\/$/, ''),
  paymentGatewaySecret: process.env.PAYMENT_GATEWAY_SECRET || '',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  paymentTimeoutMs,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  maxStreamStorageHours,
  dataDir: process.env.DATA_DIR || './data',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || process.env.GMAIL_USER || '',
  smtpAppPassword: process.env.SMTP_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '',
  smtpFrom: process.env.SMTP_FROM || process.env.GMAIL_USER || '',
};

if (env.nodeEnv === 'production' && env.corsOrigin === '*') {
  throw new Error('CORS_ORIGIN=* is not allowed in production.');
}

export type IntegrationFlags = {
  privateApi: boolean;
  firebase: boolean;
  payments: boolean;
  googleAuth: boolean;
  sessions: boolean;
  mail: boolean;
};

export function integrationFlags(): IntegrationFlags {
  return {
    privateApi: Boolean(env.privateApiBaseUrl && env.privateApiKey),
    firebase: Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey),
    payments: Boolean(env.paymentGatewayBaseUrl && env.paymentGatewaySecret),
    googleAuth: Boolean(env.googleClientId),
    sessions: Boolean(env.sessionSecret && env.sessionSecret.length >= 32),
    mail: Boolean((env.smtpUser || '') && (env.smtpAppPassword || '')),
  };
}

export function publicIntegrationStatus() {
  const flags = integrationFlags();
  return {
    privateApi: flags.privateApi ? 'configured' : 'NOT_CONFIGURED',
    firebase: flags.firebase ? 'configured' : 'NOT_CONFIGURED',
    paymentGateway: flags.payments ? 'configured' : 'NOT_CONFIGURED',
    googleAuth: flags.googleAuth ? 'configured' : 'NOT_CONFIGURED',
    mail: flags.mail ? 'configured' : 'NOT_CONFIGURED',
  };
}
