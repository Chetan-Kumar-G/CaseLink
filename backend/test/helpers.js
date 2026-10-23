// Test bootstrap: an in-memory MongoDB, a fake AI service with predictable
// answers, and the real Express app. Environment is set before any app module
// loads, because config is read once at import time.
import http from 'node:http';

const FAKE_PROMISE_TEXT = 'The refund of Rs 85,000 will be processed within 30 days after approval of the management.';

function startFakeAi() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = (data) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      if (req.url === '/health') return json({ status: 'ok', mode: 'fake', model: 'test', threshold: 0.5 });
      const input = body ? JSON.parse(body) : {};
      if (req.url === '/similarity') {
        // Identical text scores 1, anything else 0.
        return json({
          mode: 'fake',
          model: 'test',
          threshold: 0.5,
          results: input.candidates.map((c) => ({ id: c.id, score: c.text === input.query.text ? 1 : 0, shared_terms: [] })),
        });
      }
      if (req.url === '/closure-check') {
        const promised = input.response.includes('within 30 days');
        return json({
          mode: 'fake',
          model: 'test',
          concerns: [{ id: 'c1', label: 'Refund of fees', text: 'not refunded', start: 0, end: 12, concepts: ['refund'], status: promised ? 'partial' : 'addressed', reason: 'test', response_span: null, similarity: 0.9, expected_evidence: null, evidence_found: [], missing_evidence: false }],
          inconsistencies: [],
          summary: { total: 1, addressed: promised ? 0 : 1, partial: promised ? 1 : 0, not_addressed: 0 },
          recommendation: promised ? 'further_review' : 'no_gaps_found',
          promises: promised
            ? [{ id: 'p1', kind: 'commitment', action: 'Refund of fees', concept: 'refund', amount: 85000, deadline: '2030-01-31', deadline_text: 'within 30 days', condition: 'approval of the management', vague: false, text: input.response, start: 0, end: input.response.length }]
            : [],
        });
      }
      res.writeHead(404).end();
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let ctx;

export async function setup() {
  if (ctx) return ctx;
  const ai = await startFakeAi();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGO_URI: '',
    DEV_DB_PATH: 'memory',
    AI_SERVICE_URL: `http://127.0.0.1:${ai.address().port}`,
    AI_TIMEOUT_MS: '3000',
    SEED_PASSWORD: 'Test-Password-2026',
    AUTO_SEED: 'false',
    SMTP_URL: '',
    CRON_SECRET: 'test-cron-secret',
    DEMO_MODE: 'false',
  });
  const { connectDb, disconnectDb } = await import('../src/config/db.js');
  const { createApp } = await import('../src/app.js');
  const { seedDatabase } = await import('../src/seed/seed.js');
  await connectDb();
  await seedDatabase({ waitForAiSeconds: 0, log: () => {} });
  const app = createApp();
  ctx = {
    app,
    password: 'Test-Password-2026',
    promiseText: FAKE_PROMISE_TEXT,
    async teardown() {
      await disconnectDb();
      ai.close();
    },
  };
  return ctx;
}

/** A supertest agent signed in as the given seeded user (keeps the session cookie). */
export async function signIn(request, app, email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
