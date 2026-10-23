import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, signIn } from './helpers.js';

let ctx;
let officer; // PGRC officer
let rbOfficer;
let reviewer;
let portal; // Sunrise Institute portal account

before(async () => {
  ctx = await setup();
  officer = await signIn(request, ctx.app, 'pgrc.officer@caselink.local', ctx.password);
  rbOfficer = await signIn(request, ctx.app, 'rb.officer@caselink.local', ctx.password);
  reviewer = await signIn(request, ctx.app, 'reviewer@caselink.local', ctx.password);
  portal = await signIn(request, ctx.app, 'sunrise.portal@caselink.local', ctx.password);
});
after(async () => ctx.teardown());

const findCase = async (agent, q) => (await agent.get('/api/cases').query({ q })).body.cases[0];

describe('platform', () => {
  test('health and readiness', async () => {
    const health = await request(ctx.app).get('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.db, true);
    assert.equal(health.body.ai.reachable, true);
    assert.equal((await request(ctx.app).get('/api/ready')).status, 200);
  });

  test('security headers are set', async () => {
    const res = await request(ctx.app).get('/api/health');
    assert.match(res.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  test('unknown API routes return JSON 404', async () => {
    const res = await request(ctx.app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });
});

describe('authentication', () => {
  test('wrong password is rejected without revealing which part was wrong', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'pgrc.officer@caselink.local', password: 'wrong' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Incorrect email or password');
  });

  test('session cookie is httpOnly and SameSite=Strict', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'ab.officer@caselink.local', password: ctx.password });
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  test('account locks after five failed attempts', async () => {
    const email = 'admin@caselink.local';
    for (let i = 0; i < 5; i += 1) await request(ctx.app).post('/api/auth/login').send({ email, password: `bad-${i}` });
    const res = await request(ctx.app).post('/api/auth/login').send({ email, password: ctx.password });
    assert.equal(res.status, 423);
  });

  test('sign-out revokes the session', async () => {
    const agent = await signIn(request, ctx.app, 'pgrc.head@caselink.local', ctx.password);
    assert.equal((await agent.get('/api/auth/me')).status, 200);
    await agent.post('/api/auth/logout');
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });

  test('protected routes require a session', async () => {
    assert.equal((await request(ctx.app).get('/api/cases')).status, 401);
  });
});

describe('authorisation', () => {
  test('institution accounts cannot reach staff routes', async () => {
    assert.equal((await portal.get('/api/cases')).status, 403);
    assert.equal((await portal.get('/api/dashboard/summary')).status, 403);
  });

  test('staff cannot use the institution portal', async () => {
    assert.equal((await officer.get('/api/portal/cases')).status, 403);
  });

  test('officers cannot read the audit trail; senior reviewers cannot register cases', async () => {
    assert.equal((await officer.get('/api/audit')).status, 403);
    const res = await reviewer.post('/api/cases').send({});
    assert.equal(res.status, 403);
  });

  test('complainant identity is masked outside the owning bureau', async () => {
    const own = await findCase(officer, 'Fee refund not processed');
    assert.equal(own.complainant.masked, false);
    assert.ok(own.complainant.email);
    const other = await findCase(rbOfficer, 'Fee refund not processed');
    assert.equal(other.complainant.masked, true);
    assert.equal(other.complainant.email, undefined);
  });

  test('another bureau cannot change the case', async () => {
    const c = await findCase(rbOfficer, 'Fee refund not processed');
    const res = await rbOfficer.patch(`/api/cases/${c.id}/status`).send({ status: 'awaiting_institution', note: 'Not my case' });
    assert.equal(res.status, 403);
  });
});

describe('cases and overlaps', () => {
  const base = { permanentId: '1-1357924680', channel: 'portal', category: 'certificates', subject: 'Certificates held back again', description: 'The college is still refusing to return my original certificates after transfer.' };

  test('input is validated field by field', async () => {
    const res = await officer.post('/api/cases').send({ ...base, permanentId: 'x', complainant: { name: '' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.permanentId);
    assert.ok(res.body.fields['complainant.name']);
  });

  test('the same complainant filing again is flagged as a probable duplicate', async () => {
    const res = await officer.post('/api/cases').send({ ...base, complainant: { name: 'Pooja Sharma', email: 'POOJA.SHARMA@example.com' } });
    assert.equal(res.status, 201);
    const dup = res.body.overlaps.find((o) => o.kind === 'duplicate');
    assert.ok(dup, 'expected a duplicate overlap');
    assert.ok(dup.evidence.layers.includes('exact'));
  });

  test('cases cannot be marked resolved by hand', async () => {
    const c = await findCase(officer, 'Fee refund not processed');
    const res = await officer.patch(`/api/cases/${c.id}/status`).send({ status: 'resolved', note: 'Trying to skip review' });
    assert.equal(res.status, 409);
  });
});

describe('Promise Ledger', () => {
  let caseId;
  let token;

  test('a promise in the reply is extracted and the reply is flagged as a template', async () => {
    const c = await findCase(officer, 'Fee refund not processed');
    caseId = c.id;
    const res = await officer.post(`/api/cases/${caseId}/responses`).send({ source: 'institution_letter', text: ctx.promiseText, evidence: [] });
    assert.equal(res.status, 201);
    const r = res.body.case.responses.at(-1);
    assert.equal(r.review.promises.length, 1);
    assert.equal(r.review.promises[0].amount, 85000);
    assert.equal(r.template.others, 2, 'seeded history has the same wording for two other complainants');
  });

  test('resolve on promise requires choosing a promise, then creates a ledger entry', async () => {
    const c = (await officer.get(`/api/cases/${caseId}`)).body.case;
    const rid = c.responses.at(-1)._id;
    const bad = await officer.post(`/api/cases/${caseId}/responses/${rid}/decision`).send({ outcome: 'accept_on_promise', reason: 'Institution committed in writing.' });
    assert.equal(bad.status, 400);
    const ok = await officer
      .post(`/api/cases/${caseId}/responses/${rid}/decision`)
      .send({ outcome: 'accept_on_promise', reason: 'Institution committed in writing.', promises: [{ id: 'p1', dueDate: '2030-01-31T23:59:59' }] });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.case.status, 'resolved_on_promise');
    const detail = (await officer.get(`/api/cases/${caseId}`)).body;
    assert.equal(detail.ledger.length, 1);
    assert.equal(detail.ledger[0].status, 'pending');
    assert.equal(detail.ledger[0].checkIn?.token, undefined, 'tokens are never sent to staff views');
  });

  test('fast-forward sends the complainant check-in', async () => {
    const entry = (await officer.get(`/api/cases/${caseId}`)).body.ledger[0];
    const res = await officer.post(`/api/promises/${entry._id}/fast-forward`);
    assert.equal(res.status, 200);
    token = res.body.checkInUrl.split('/').pop();
    const pub = await request(ctx.app).get(`/api/checkin/${token}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.institution, 'Sunrise Institute of Technology');
    assert.equal(pub.body.complainant, undefined);
    assert.ok(!JSON.stringify(pub.body).includes('@'), 'no email in the public payload');
  });

  test('"No" reopens the case, raises priority, escalates, and lowers the Promise Kept Rate', async () => {
    const before = (await officer.get('/api/institutions/1-2468013579')).body.promises.record.rate;
    const res = await request(ctx.app).post(`/api/checkin/${token}`).send({ answer: 'no', comment: 'Not received' });
    assert.equal(res.status, 200);
    assert.equal(res.body.reopened, true);
    const c = (await officer.get(`/api/cases/${caseId}`)).body.case;
    assert.equal(c.status, 'under_review');
    assert.equal(c.priority, 'urgent');
    assert.ok(c.escalationLevel >= 1);
    assert.equal(c.history.at(-1).action, 'promise_broken');
    const afterRate = (await officer.get('/api/institutions/1-2468013579')).body.promises.record.rate;
    assert.equal(before, 80);
    assert.equal(afterRate, 67);
  });

  test('a check-in link works once; unknown links are rejected', async () => {
    assert.equal((await request(ctx.app).post(`/api/checkin/${token}`).send({ answer: 'yes' })).status, 409);
    assert.equal((await request(ctx.app).get('/api/checkin/not-a-real-token-1234567890')).status, 404);
    assert.equal((await request(ctx.app).post(`/api/checkin/${token}`).send({ answer: 'maybe' })).status, 400);
  });

  test('the institution sees its own commitment in the portal', async () => {
    const res = await portal.get(`/api/portal/cases/${caseId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.case.commitments[0].status, 'broken');
    assert.equal(res.body.case.complainant, undefined);
  });
});

describe('audit trail', () => {
  test('the hash chain verifies, and detects a direct database edit', async () => {
    const ok = await reviewer.get('/api/audit/verify');
    assert.equal(ok.body.valid, true);
    const { AuditLog } = await import('../src/models/AuditLog.js');
    await assert.rejects(() => AuditLog.updateOne({ seq: 1 }, { summary: 'x' }), /append-only/);
    await AuditLog.collection.updateOne({ seq: 2 }, { $set: { summary: 'tampered' } });
    const bad = await reviewer.get('/api/audit/verify');
    assert.equal(bad.body.valid, false);
    assert.equal(bad.body.brokenAt, 2);
  });
});

describe('import adapter', () => {
  test('dry run validates every row and saves nothing', async () => {
    const admin = await signIn(request, ctx.app, 'pgrc.head@caselink.local', ctx.password);
    const rows = [
      { externalRef: 'T-1', bureau: 'PGRC', permanentId: '1-5566778899', channel: 'cpgrams', category: 'fee_refund', subject: 'Refund pending for weeks', description: 'The institute has not refunded my fee after cancellation.', complainantName: 'Test Person' },
      { externalRef: 'T-2', bureau: 'RB', permanentId: '1-5566778899', channel: 'cpgrams', category: 'fee_refund', subject: 'Other bureau row', description: 'A head may only import cases for their own bureau.', complainantName: 'Other Person' },
    ];
    const res = await admin.post('/api/import/cases').send({ rows, dryRun: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, 1);
    assert.match(res.body.results[1].errors.bureau, /only import PGRC/);
    const listed = await admin.get('/api/cases').query({ q: 'Refund pending for weeks' });
    assert.equal(listed.body.total, 0);
  });
});

describe('serverless operations', () => {
  test('cron tick requires the cron secret', async () => {
    assert.equal((await request(ctx.app).get('/api/cron/tick')).status, 401);
    assert.equal((await request(ctx.app).get('/api/cron/tick').set('Authorization', 'Bearer wrong')).status, 401);
    const ok = await request(ctx.app).get('/api/cron/tick').set('Authorization', 'Bearer test-cron-secret');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ok, true);
  });

  test('demo reset does not exist outside DEMO_MODE', async () => {
    const res = await request(ctx.app).post('/api/demo/reset').set('x-demo-token', 'anything');
    assert.equal(res.status, 404);
  });

  test('concurrent audit writes stay linked in sequence', async () => {
    const { auditSystem } = await import('../src/services/audit.js');
    const { AuditLog } = await import('../src/models/AuditLog.js');
    await Promise.all(Array.from({ length: 10 }, (_, i) => auditSystem('test.concurrent', { summary: `write ${i}` })));
    const rows = await AuditLog.find({ action: 'test.concurrent' }).sort({ seq: 1 }).lean();
    assert.equal(rows.length, 10);
    for (let i = 1; i < rows.length; i += 1) {
      assert.equal(rows[i].seq, rows[i - 1].seq + 1);
      assert.equal(rows[i].prevHash, rows[i - 1].hash);
    }
  });
});

describe('copy-paste detection', () => {
  test('numbers are normalised, different wording is not a template', async () => {
    const { similarity } = await import('../src/services/templateReplies.js');
    const a = 'The refund of Rs 12,000 will be processed within 30 days after approval of the management.';
    const b = 'The refund of Rs 60,000 will be processed within 45 days after approval of the management.';
    const c = 'We have returned the full fee to the student by bank transfer last Monday.';
    assert.ok(similarity(a, b) > 0.6);
    assert.ok(similarity(a, c) < 0.2);
  });
});
