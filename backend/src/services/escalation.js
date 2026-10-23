import { Case } from '../models/Case.js';
import { ESCALATION, OPEN_STATUSES, slaDaysFor } from '../config/domain.js';
import { auditSystem } from './audit.js';
import { notify } from './notify.js';
import { runPromiseChecks } from './promiseLedger.js';

const DAY = 86_400_000;

/**
 * One pass of the escalation chain over all open cases with a deadline:
 *   - reminder to the assigned officer once `reminderAt` of the SLA has passed;
 *   - each configured level once the case is overdue by `afterOverdueDays`.
 * Each step fires once per case (tracked on the case), so the job is idempotent.
 */
export async function runEscalations(now = new Date()) {
  const cases = await Case.find({ status: { $in: OPEN_STATUSES }, dueDate: { $ne: null } });
  const summary = { checked: cases.length, reminders: 0, escalations: 0 };

  for (const c of cases) {
    const due = c.dueDate.getTime();
    const sla = slaDaysFor(c.category) * DAY;
    const overdueDays = Math.floor((now.getTime() - due) / DAY);
    let changed = false;

    if (!c.reminderSentAt && c.escalationLevel === 0 && now.getTime() >= due - sla * (1 - ESCALATION.reminderAt) && now.getTime() < due) {
      c.reminderSentAt = now;
      changed = true;
      summary.reminders += 1;
      await notify(
        { userIds: c.assignedTo ? [c.assignedTo] : [], roles: c.assignedTo ? undefined : ['officer'], bureaus: [c.bureau] },
        {
          type: 'reminder',
          title: `Deadline approaching: ${c.caseRef}`,
          body: `Due ${c.dueDate.toDateString()}. ${c.subject}`,
          link: `/cases/${c._id}`,
        },
      );
    }

    for (const lvl of ESCALATION.levels) {
      if (overdueDays < lvl.afterOverdueDays || c.escalationLevel >= lvl.level) continue;
      c.escalationLevel = lvl.level;
      c.escalations.push({ level: lvl.level, at: now, label: lvl.label });
      c.history.push({
        at: now,
        byName: 'System',
        action: 'escalated',
        note: `${lvl.label} — ${overdueDays} day${overdueDays === 1 ? '' : 's'} past the deadline`,
      });
      changed = true;
      summary.escalations += 1;
      await notify(
        { roles: lvl.roles, bureaus: lvl.sameBureau ? [c.bureau] : undefined },
        {
          type: 'escalation',
          title: `${lvl.label}: ${c.caseRef}`,
          body: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue — ${c.subject}`,
          link: `/cases/${c._id}`,
        },
      );
      await auditSystem('case.escalated', {
        entityType: 'case',
        entityId: c._id,
        summary: `${c.caseRef}: ${lvl.label} (${overdueDays}d overdue)`,
        meta: { level: lvl.level, overdueDays },
      });
    }

    if (changed) await c.save();
  }
  return summary;
}

let timer = null;
export function startEscalationScheduler(intervalMin) {
  const tick = () =>
    runEscalations()
      .then((s) => s.reminders + s.escalations && console.log(`[escalation] ${s.reminders} reminder(s), ${s.escalations} escalation(s)`))
      .then(() => runPromiseChecks())
      .then((p) => p.checkInsSent + p.unconfirmed && console.log(`[ledger] ${p.checkInsSent} check-in(s) sent, ${p.unconfirmed} unconfirmed`))
      .catch((err) => console.error('[escalation] run failed:', err.message));
  tick();
  timer = setInterval(tick, intervalMin * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
