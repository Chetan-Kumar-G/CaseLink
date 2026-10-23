import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { slaDaysFor } from '../config/domain.js';
import { Institution } from '../models/Institution.js';
import { User } from '../models/User.js';
import { Case } from '../models/Case.js';
import { OverlapLink } from '../models/OverlapLink.js';
import { nextSequence } from '../models/Counter.js';
import { aiHealth } from '../services/aiClient.js';
import { auditSystem } from '../services/audit.js';
import { detectOverlaps } from '../services/overlapEngine.js';
import { detectLanguage, extractCaseRefs, identityHash } from '../utils/text.js';
import * as data from './data.js';
import { seedPromiseHistory } from './ledgerSeed.js';

const DAY = 86_400_000;

async function waitForAi(maxSeconds = 25) {
  for (let i = 0; i < maxSeconds; i += 1) {
    const h = await aiHealth();
    if (h.reachable) return h;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { reachable: false };
}

export async function seedDatabase({ waitForAiSeconds = 25, log = console.log } = {}) {
  if (env.isProd && !env.demoMode) throw new Error('Refusing to seed (drops the database) in production; set DEMO_MODE=true for a demo deployment');
  log('[seed] resetting database with synthetic data…');
  await mongoose.connection.db.dropDatabase();
  const { Notification } = await import('../models/Notification.js');
  const { LedgerEntry } = await import('../models/LedgerEntry.js');
  await Promise.all([User, Institution, Case, OverlapLink, Notification, LedgerEntry].map((m) => m.syncIndexes()));
  const { AuditLog } = await import('../models/AuditLog.js');
  await AuditLog.syncIndexes();

  const insts = new Map();
  for (const i of data.institutions) insts.set(i.permanentId, await Institution.create(i));

  const users = {};
  for (const u of data.users) {
    const doc = new User({ name: u.name, email: u.email, role: u.role, bureau: u.bureau, designation: u.designation, institution: u.institutionPid ? insts.get(u.institutionPid)._id : undefined });
    await doc.setPassword(env.seedPassword);
    users[u.key] = await doc.save();
  }

  const ordered = [...data.cases].sort((a, b) => b.daysAgo - a.daysAgo);
  const created = [];
  for (const c of ordered) {
    const inst = insts.get(c.inst);
    const owner = users[c.owner];
    const createdAt = new Date(Date.now() - c.daysAgo * DAY);
    const year = createdAt.getFullYear();
    const seq = await nextSequence(`case:${c.bureau}:${year}`);
    const caseRef = `${c.bureau}/${year}/${String(seq).padStart(4, '0')}`;
    const history = [{ at: createdAt, by: owner._id, byName: owner.name, action: 'registered', note: `Registered via ${c.channel}`, to: 'registered' }];
    if (c.status !== 'registered') {
      history.push({ at: new Date(createdAt.getTime() + 2 * DAY), by: owner._id, byName: owner.name, action: 'status_changed', note: 'Initial review completed', from: 'registered', to: c.status });
    }
    const doc = new Case({
      caseRef,
      bureau: c.bureau,
      institution: inst._id,
      permanentId: inst.permanentId,
      channel: c.channel,
      category: c.category,
      priority: c.priority,
      status: c.status,
      subject: c.subject,
      description: c.description,
      language: detectLanguage(`${c.subject} ${c.description}`),
      complainant: { ...c.complainant, idHash: identityHash(c.complainant) },
      relatedRefs: extractCaseRefs(c.description),
      assignedTo: owner._id,
      assignedToName: owner.name,
      dueDate: new Date(createdAt.getTime() + slaDaysFor(c.category) * DAY),
      closedAt: c.status === 'closed' ? new Date(createdAt.getTime() + 30 * DAY) : undefined,
      createdBy: owner._id,
      history,
      createdAt,
      updatedAt: history.at(-1).at,
    });
    created.push(await doc.save({ timestamps: false }));
  }

  await auditSystem('system.seed', {
    summary: `Seeded ${created.length} synthetic cases across ${insts.size} institutions`,
    meta: { cases: created.length, institutions: insts.size, users: data.users.length },
  });

  const ai = waitForAiSeconds ? await waitForAi(waitForAiSeconds) : await aiHealth();
  log(ai.reachable ? `[seed] AI service reachable (${ai.mode})` : '[seed] AI service not reachable — semantic layer skipped; use "Re-scan" on a case later');

  for (const c of created) await detectOverlaps(c._id, { notify: false });

  // One already-decided overlap so the history and audit views are not empty.
  const [first, second] = created.filter((c) => c.permanentId === '1-1357924680' && c.category === 'certificates');
  const dup = first && second && (await OverlapLink.findOne({ $or: [{ caseA: first._id, caseB: second._id }, { caseA: second._id, caseB: first._id }] }));
  if (dup) {
    const head = users.pgrcHead;
    dup.status = 'linked';
    dup.decision = { by: head._id, byName: head.name, byBureau: head.bureau, at: new Date(), reason: 'Same complainant raised the same certificate issue with AB; PGRC will lead.' };
    await dup.save();
    for (const [self, other] of [[first, second], [second, first]]) {
      await Case.updateOne({ _id: self._id }, { $push: { history: { at: new Date(), by: head._id, byName: head.name, action: 'overlap_linked', note: `Linked with ${other.caseRef}: ${dup.decision.reason}` } } });
    }
    await auditSystem('overlap.link', { entityType: 'overlap', entityId: dup._id, summary: `Seed decision by ${head.name}: ${first.caseRef} ↔ ${second.caseRef}` });
  }

  const promiseCount = await seedPromiseHistory(insts, users);
  const total = await OverlapLink.countDocuments();
  log(`[seed] done — ${created.length} cases, ${total} overlaps, ${promiseCount} ledger promises, ${data.users.length} users (password from SEED_PASSWORD)`);
}

// `npm run seed` against the database in MONGO_URI.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { connectDb, disconnectDb } = await import('../config/db.js');
  if (!env.mongoUri) {
    console.error('[seed] Set MONGO_URI to seed a persistent database (the in-memory DB seeds itself on start).');
    process.exit(1);
  }
  await connectDb();
  await seedDatabase();
  await disconnectDb();
}
