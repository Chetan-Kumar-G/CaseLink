import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { User } from './models/User.js';
import { seedDatabase } from './seed/seed.js';

// Serverless entry (Vercel): one Express app and one database connection per
// warm instance, reused across invocations. There is no background scheduler
// here — escalations and promise check-ins run from /api/cron/tick.
const app = createApp();
let ready = null;

async function init() {
  await connectDb();
  // A fresh demo deployment seeds itself on its first request.
  if (env.autoSeed && (await User.estimatedDocumentCount()) === 0) {
    await seedDatabase({ waitForAiSeconds: 10 });
  }
}

export default async function handler(req, res) {
  try {
    ready ??= init();
    await ready;
  } catch (err) {
    ready = null; // retry on the next request
    console.error('[api] startup failed:', err.message);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Service is starting up or the database is unreachable. Please retry.' }));
    return;
  }
  return app(req, res);
}
