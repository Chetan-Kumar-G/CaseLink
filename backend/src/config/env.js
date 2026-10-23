import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// All configuration is read and validated here, once, at startup. In
// production the process refuses to start on a missing or weak setting rather
// than running insecurely.

const bool = (def) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

// On Vercel the production domain is known, so the app URL and the AI service
// (deployed in the same project under /ai) need no configuration.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGO_URI: z.string().trim().optional().default(''),
  DEV_DB_PATH: z.string().trim().default('.data/db'),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'use a duration like 8h').default('8h'),
  IDENTITY_PEPPER: z.string().optional(),
  CLIENT_ORIGIN: z.string().default(vercelUrl || 'http://localhost:5173'),
  APP_URL: z.string().url().default(vercelUrl || 'http://localhost:5173'),
  AI_SERVICE_URL: z.string().url().default(vercelUrl ? `${vercelUrl}/ai` : 'http://127.0.0.1:8001'),
  AI_SERVICE_KEY: z.string().optional().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8000),
  SMTP_URL: z.string().optional().default(''),
  MAIL_FROM: z.string().default('CaseLink <no-reply@caselink.local>'),
  ESCALATION_INTERVAL_MIN: z.coerce.number().min(0.1).max(1440).default(5),
  SEED_PASSWORD: z.string().optional(),
  AUTO_SEED: bool(true),
  TRUST_PROXY: z.string().optional().default(process.env.VERCEL ? '1' : '0'),
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" to /api/cron/tick.
  CRON_SECRET: z.string().optional().default(''),
  // DEMO_MODE only: token for POST /api/demo/reset (re-seeds the demo data).
  DEMO_RESET_TOKEN: z.string().optional().default(''),
  // Public demo deployments: seeds synthetic data when the database is empty,
  // shows demo accounts on the login page and enables the demo controls.
  DEMO_MODE: bool(false),
  // Serve the built frontend (frontend/dist) from the API: one origin, first-party cookies.
  SERVE_WEB: bool(false),
  WEB_DIST: z.string().default('../frontend/dist'),
  LOG_FORMAT: z.enum(['dev', 'combined', 'none']).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid configuration:\n${lines}`);
}
const raw = parsed.data;
const isProd = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';
const DEFAULT_SEED_PASSWORD = 'CaseLink@2026';

// Development secrets are generated once and kept beside the local database,
// so hashes and sessions stay valid across restarts.
const devSecretsFile = path.resolve('.data/dev-secrets.json');
let devSecrets = null;
function devSecret(name) {
  if (!devSecrets) {
    try {
      devSecrets = JSON.parse(fs.readFileSync(devSecretsFile, 'utf8'));
    } catch {
      devSecrets = {};
    }
  }
  if (!devSecrets[name]) {
    devSecrets[name] = crypto.randomBytes(48).toString('hex');
    if (raw.DEV_DB_PATH !== 'memory' && !isTest) {
      fs.mkdirSync(path.dirname(devSecretsFile), { recursive: true });
      fs.writeFileSync(devSecretsFile, JSON.stringify(devSecrets, null, 2), { mode: 0o600 });
    }
  }
  return devSecrets[name];
}

const problems = [];
function secret(name) {
  const value = raw[name];
  if (value && value.length >= 32) return value;
  if (isProd) {
    problems.push(`${name} must be at least 32 characters (generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`);
    return '';
  }
  return devSecret(name);
}

const clientOrigins = raw.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
const seedPassword = raw.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;

if (isProd) {
  if (!raw.MONGO_URI) problems.push('MONGO_URI is required in production');
  if (!raw.APP_URL.startsWith('https://') && !raw.APP_URL.includes('localhost')) problems.push('APP_URL should be an https:// address in production');
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProd,
  isTest,
  port: raw.PORT,
  mongoUri: raw.MONGO_URI,
  devDbPath: raw.DEV_DB_PATH,
  jwtSecret: secret('JWT_SECRET'),
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
  identityPepper: secret('IDENTITY_PEPPER'),
  clientOrigins,
  appUrl: raw.APP_URL.replace(/\/$/, ''),
  aiServiceUrl: raw.AI_SERVICE_URL.replace(/\/$/, ''),
  aiServiceKey: raw.AI_SERVICE_KEY,
  aiTimeoutMs: raw.AI_TIMEOUT_MS,
  smtpUrl: raw.SMTP_URL,
  mailFrom: raw.MAIL_FROM,
  escalationIntervalMin: raw.ESCALATION_INTERVAL_MIN,
  seedPassword,
  demoMode: raw.DEMO_MODE,
  // Synthetic data is seeded into an empty database in development, or in
  // production only for an explicit demo deployment.
  autoSeed: raw.AUTO_SEED && (!isProd || raw.DEMO_MODE),
  // Demo controls (fast-forward) never exist in a real production deployment.
  demoControls: !isProd || raw.DEMO_MODE,
  serveWeb: raw.SERVE_WEB,
  serverless: Boolean(process.env.VERCEL),
  cronSecret: raw.CRON_SECRET,
  demoResetToken: raw.DEMO_RESET_TOKEN,
  webDist: path.resolve(raw.WEB_DIST),
  trustProxy: /^\d+$/.test(raw.TRUST_PROXY) ? Number(raw.TRUST_PROXY) : raw.TRUST_PROXY === 'true',
  logFormat: raw.LOG_FORMAT || (isTest ? 'none' : isProd ? 'combined' : 'dev'),
  cookieMaxAgeMs: (() => {
    const [, n, unit] = raw.JWT_EXPIRES_IN.match(/^(\d+)([smhd])$/);
    return Number(n) * { s: 1e3, m: 6e4, h: 3.6e6, d: 8.64e7 }[unit];
  })(),
};

if (problems.length) {
  throw new Error(`Refusing to start in production:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
}
