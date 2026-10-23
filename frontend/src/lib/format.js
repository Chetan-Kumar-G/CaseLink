const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—');

export function timeAgo(d) {
  if (!d) return '—';
  const diff = (new Date(d) - Date.now()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, s] of units) {
    if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), unit);
  }
  return 'just now';
}

export function dueLabel(dueDate, isOpen) {
  if (!dueDate || !isOpen) return null;
  const days = Math.ceil((new Date(dueDate) - Date.now()) / 86400000);
  if (days < 0) return { text: `${-days}d overdue`, tone: 'critical' };
  if (days <= 3) return { text: `Due in ${days}d`, tone: 'warning' };
  return { text: `Due in ${days}d`, tone: 'neutral' };
}

export const ROLE_LABEL = {
  officer: 'Bureau officer',
  bureau_head: 'Bureau head',
  senior_reviewer: 'Senior reviewer',
  admin: 'Administrator',
  institution: 'Institution portal',
};

export const AUDIT_LABEL = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.login_failed': 'Failed sign-in',
  'auth.login_blocked': 'Sign-in blocked',
  'case.create': 'Case registered',
  'case.view': 'Case viewed',
  'case.status_change': 'Status changed',
  'case.note': 'Note added',
  'case.rescan': 'Overlap re-scan',
  'institution.view': 'Institution 360 viewed',
  'overlap.detected': 'Overlap detected',
  'overlap.link': 'Cases linked',
  'overlap.dismiss': 'Overlap dismissed',
  'overlap.coordinate': 'Coordination requested',
  'audit.verify': 'Audit chain verified',
  'case.response': 'Institution response recorded',
  'closure.review': 'ClosureGuard re-run',
  'closure.decision': 'Closure decision',
  'system.seed': 'Synthetic data seeded',
  'case.escalated': 'Case escalated',
  'case.import': 'Cases imported',
  'portal.case_view': 'Institution viewed case',
  'escalation.run': 'Escalation check run',
  'promise.check_in_sent': 'Promise check-in sent',
  'promise.kept': 'Promise kept',
  'promise.partly_kept': 'Promise partly kept',
  'promise.broken': 'Promise broken — case reopened',
  'promise.fast_forward': 'Demo: promise fast-forwarded',
};

export const HISTORY_LABEL = {
  registered: 'Registered',
  status_changed: 'Status changed',
  note: 'Note',
  overlap_linked: 'Linked case',
  overlap_dismissed: 'Overlap dismissed',
  coordination_requested: 'Coordination requested',
  response_recorded: 'Institution response recorded',
  closure_accepted: 'Resolution accepted',
  closure_more_requested: 'Further action requested',
  escalated: 'Escalated',
  resolved_on_promise: 'Resolved on promise',
  promise_kept: 'Promise kept',
  promise_broken: 'Promise broken',
};

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
