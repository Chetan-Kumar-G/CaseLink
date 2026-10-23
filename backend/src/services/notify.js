import { env } from '../config/env.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

let transporter = null;
async function mailer() {
  if (!env.smtpUrl) return null;
  if (!transporter) {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.default.createTransport(env.smtpUrl);
  }
  return transporter;
}

/**
 * Resolves recipients from user ids and/or role filters, e.g.
 *   { roles: ['officer', 'bureau_head'], bureaus: ['RB'] }
 *   { roles: ['institution'], institution: id }
 */
export async function recipients({ userIds = [], roles, bureaus, institution, exclude } = {}) {
  const or = [];
  if (userIds.length) or.push({ _id: { $in: userIds } });
  if (roles?.length) {
    const q = { role: { $in: roles } };
    if (bureaus?.length) q.bureau = { $in: bureaus };
    if (institution) q.institution = institution;
    or.push(q);
  }
  if (!or.length) return [];
  const users = await User.find({ $or: or, active: true }, { name: 1, email: 1 }).lean();
  const ex = exclude?.toString();
  return users.filter((u) => u._id.toString() !== ex);
}

// In-app notification for each recipient; email too when SMTP is configured.
// Failures are logged, never thrown — notifications must not break the workflow.
export async function notify(target, { type, title, body, link }) {
  try {
    const users = await recipients(target);
    if (!users.length) return 0;
    const docs = await Notification.insertMany(users.map((u) => ({ user: u._id, type, title, body, link })));

    const t = await mailer();
    if (t) {
      await Promise.allSettled(
        users.map((u) =>
          t.sendMail({
            from: env.mailFrom,
            to: u.email,
            subject: `[CaseLink] ${title}`,
            text: `${body || ''}\n\n${link ? `${env.appUrl}${link}` : env.appUrl}\n\n— CaseLink (automated message)`,
          }),
        ),
      );
      await Notification.updateMany({ _id: { $in: docs.map((d) => d._id) } }, { emailed: true });
    } else if (!env.isProd && !env.isTest) {
      console.log(`[notify] ${type} → ${users.map((u) => u.email).join(', ')}: ${title}`);
    }
    return users.length;
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return 0;
  }
}
