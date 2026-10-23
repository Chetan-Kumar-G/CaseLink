import clsx from 'clsx';
import { AlertOctagon, CheckCircle2, CircleDot, Clock, HandCoins, Hourglass, Lock, Network, TrendingUp, Users } from 'lucide-react';
import { useMeta } from '../context/AuthContext.jsx';

export const BUREAU_STYLE = {
  PGRC: { chip: 'bg-teal-50 text-teal-700 ring-teal-100', dot: 'bg-teal-500', bar: 'bg-teal-500', soft: 'bg-teal-50' },
  RB: { chip: 'bg-ember-100 text-ember-800 ring-ember-200', dot: 'bg-ember-600', bar: 'bg-ember-600', soft: 'bg-ember-50' },
  AB: { chip: 'bg-plum-50 text-plum-700 ring-plum-100', dot: 'bg-plum-500', bar: 'bg-plum-500', soft: 'bg-plum-50' },
};

export function BureauBadge({ code, full }) {
  const { bureauName } = useMeta();
  const s = BUREAU_STYLE[code] || BUREAU_STYLE.RB;
  return (
    <span className={clsx('chip ring-1 ring-inset', s.chip)} title={bureauName(code)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {full ? bureauName(code) : code}
    </span>
  );
}

const STATUS_STYLE = {
  registered: { cls: 'bg-paper-deep text-ink-soft', icon: CircleDot },
  under_review: { cls: 'bg-ember-50 text-ember-700', icon: Clock },
  awaiting_institution: { cls: 'bg-honey-50 text-honey-700', icon: Hourglass },
  coordination: { cls: 'bg-teal-50 text-teal-700', icon: Users },
  resolved: { cls: 'bg-sage-50 text-sage-700', icon: CheckCircle2 },
  resolved_on_promise: { cls: 'bg-ember-50 text-ember-800 ring-1 ring-inset ring-ember-200', icon: HandCoins },
  closed: { cls: 'bg-ink/5 text-ink-muted', icon: Lock },
};

export function StatusBadge({ status }) {
  const { statusLabel } = useMeta();
  const s = STATUS_STYLE[status] || STATUS_STYLE.registered;
  const Icon = s.icon;
  return (
    <span className={clsx('chip', s.cls)}>
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

const PRIORITY = {
  urgent: 'bg-rosewood-50 text-rosewood-700',
  high: 'bg-ember-50 text-ember-700',
  medium: 'bg-paper-deep text-ink-soft',
  low: 'bg-paper-soft text-ink-muted',
};

export function PriorityBadge({ priority }) {
  return <span className={clsx('chip capitalize', PRIORITY[priority])}>{priority}</span>;
}

export function DueBadge({ due }) {
  if (!due) return null;
  const cls = { critical: 'bg-rosewood-50 text-rosewood-700', warning: 'bg-honey-50 text-honey-700', neutral: 'bg-paper-soft text-ink-muted' }[due.tone];
  return (
    <span className={clsx('chip', cls)}>
      {due.tone === 'critical' ? <AlertOctagon className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {due.text}
    </span>
  );
}

export function EscalationBadge({ level }) {
  if (!level) return null;
  return (
    <span className="chip bg-rosewood-500 text-white" title={level >= 2 ? 'Escalated to senior reviewer' : 'Escalated to bureau head'}>
      <TrendingUp className="h-3.5 w-3.5" /> {level >= 2 ? 'Escalated · senior' : 'Escalated · head'}
    </span>
  );
}

export function CrossBureauBadge() {
  return (
    <span className="chip bg-gradient-to-r from-ember-500 to-ember-600 text-white">
      <Network className="h-3.5 w-3.5" />
      Cross-bureau
    </span>
  );
}
