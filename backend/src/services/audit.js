import crypto from 'node:crypto';
import { AuditLog } from '../models/AuditLog.js';
import { stableStringify } from '../utils/text.js';

const GENESIS = '0'.repeat(64);

export function computeHash(entry) {
  const payload = stableStringify({
    seq: entry.seq,
    at: new Date(entry.at).toISOString(),
    actor: entry.actor ? entry.actor.toString() : null,
    actorName: entry.actorName ?? null,
    actorRole: entry.actorRole ?? null,
    actorBureau: entry.actorBureau ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    summary: entry.summary ?? null,
    meta: entry.meta ?? null,
    ip: entry.ip ?? null,
    prevHash: entry.prevHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Writes are serialised in-process so the chain stays linear. Across instances
// (serverless), the unique index on `seq` rejects a concurrent write and the
// append is retried on top of the new head.
let queue = Promise.resolve();

function append(fields) {
  const run = async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await appendOnce(fields);
      } catch (err) {
        if (err?.code !== 11000 || attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
      }
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

async function appendOnce(fields) {
  const last = await AuditLog.findOne({}, { seq: 1, hash: 1 }).sort({ seq: -1 }).lean();
  const entry = {
    ...fields,
    meta: fields.meta ? JSON.parse(JSON.stringify(fields.meta)) : undefined,
    seq: (last?.seq || 0) + 1,
    at: fields.at || new Date(),
    prevHash: last?.hash || GENESIS,
  };
  entry.hash = computeHash(entry);
  return AuditLog.create(entry);
}

export function audit(req, action, { entityType, entityId, summary, meta } = {}) {
  const u = req?.user;
  return append({
    actor: u?._id,
    actorName: u?.name || 'Anonymous',
    actorRole: u?.role || 'none',
    actorBureau: u?.bureau,
    action,
    entityType,
    entityId: entityId?.toString(),
    summary,
    meta,
    ip: req?.ip,
  }).catch((err) => console.error('[audit] failed to write entry', action, err.message));
}

export function auditSystem(action, { entityType, entityId, summary, meta, at } = {}) {
  return append({
    actorName: 'System',
    actorRole: 'system',
    action,
    entityType,
    entityId: entityId?.toString(),
    summary,
    meta,
    at,
  }).catch((err) => console.error('[audit] failed to write entry', action, err.message));
}

export async function verifyChain() {
  let prevHash = GENESIS;
  let expectedSeq = 1;
  let count = 0;
  const cursor = AuditLog.find().sort({ seq: 1 }).lean().cursor();
  for await (const entry of cursor) {
    count += 1;
    if (entry.seq !== expectedSeq) {
      return { valid: false, count, brokenAt: entry.seq, reason: `Missing entry before #${entry.seq}` };
    }
    if (entry.prevHash !== prevHash) {
      return { valid: false, count, brokenAt: entry.seq, reason: 'Previous-hash mismatch' };
    }
    if (computeHash(entry) !== entry.hash) {
      return { valid: false, count, brokenAt: entry.seq, reason: 'Entry contents were modified' };
    }
    prevHash = entry.hash;
    expectedSeq += 1;
  }
  return { valid: true, count, headHash: prevHash };
}
