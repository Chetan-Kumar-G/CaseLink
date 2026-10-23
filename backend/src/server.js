import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { User } from './models/User.js';
import { seedDatabase } from './seed/seed.js';
import { startEscalationScheduler } from './services/escalation.js';

async function main() {
  const { mode } = await connectDb();
  if (mode === 'memory' || (env.autoSeed && (await User.estimatedDocumentCount()) === 0)) {
    await seedDatabase();
  }
  const stopScheduler = startEscalationScheduler(env.escalationIntervalMin);

  const server = createApp().listen(env.port, () => {
    console.log(`[api] CaseLink API listening on port ${env.port} (${env.nodeEnv}${env.demoMode ? ', demo mode' : ''}${env.serveWeb ? ', serving web' : ''})`);
  });
  // Keep-alive longer than typical load-balancer idle timeouts avoids 502s.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`[api] ${signal} received — finishing in-flight requests`);
    stopScheduler();
    const force = setTimeout(() => {
      console.error('[api] forced exit after 10 s');
      process.exit(1);
    }, 10_000);
    force.unref();
    server.close(async () => {
      await disconnectDb().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => console.error('[api] unhandled rejection:', err));

main().catch((err) => {
  console.error('[api] failed to start:', err.message || err);
  process.exit(1);
});
