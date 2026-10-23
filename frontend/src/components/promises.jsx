import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { BadgeCheck, CircleDashed, Copy, ExternalLink, FastForward, FileWarning, Hourglass, MessageCircleQuestion, TimerOff } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useToast } from './Toast.jsx';
import { BureauBadge } from './badges.jsx';
import { Button } from './ui.jsx';

const DAY = 86_400_000;

// Ledger outcome uses the reserved status colours, always with icon + label.
export const PROMISE_STATUS = {
  pending: { label: 'Pending', icon: Hourglass, cls: 'bg-paper-deep text-ink-soft' },
  awaiting_confirmation: { label: 'Asking complainant', icon: MessageCircleQuestion, cls: 'bg-honey-50 text-honey-700' },
  kept: { label: 'Kept', icon: BadgeCheck, cls: 'bg-sage-50 text-sage-700' },
  partly_kept: { label: 'Partly kept', icon: CircleDashed, cls: 'bg-honey-50 text-honey-700' },
  broken: { label: 'Broken', icon: FileWarning, cls: 'bg-rosewood-50 text-rosewood-700' },
  unconfirmed: { label: 'No answer', icon: TimerOff, cls: 'bg-paper-deep text-ink-muted' },
};

export function PromiseStatus({ status }) {
  const s = PROMISE_STATUS[status] || PROMISE_STATUS.pending;
  return (
    <span className={clsx('chip', s.cls)}>
      <s.icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

export const money = (n) => (n ? `Rs ${Number(n).toLocaleString('en-IN')}` : null);

export function dueText(date, status) {
  if (!['pending', 'awaiting_confirmation'].includes(status)) return `Due ${formatDate(date)}`;
  const days = Math.ceil((new Date(date) - Date.now()) / DAY);
  if (status === 'awaiting_confirmation') return 'Deadline reached — waiting for the complainant';
  if (days <= 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'} · ${formatDate(date)}`;
}

/** Promise Kept Rate as a compact ring. `rate` may be null when nothing is decided yet. */
export function RateRing({ rate, size = 84, stroke = 9, label = 'kept' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = rate ?? 0;
  const color = rate == null ? '#C4B5A9' : rate >= 75 ? '#3F8F5B' : rate >= 50 ? '#C98A0B' : '#C2412D';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size} role="img" aria-label={rate == null ? 'No promise outcomes yet' : `${rate}% of promises kept`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F7E9DA" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className="font-extrabold text-ink" style={{ fontSize: size * 0.24 }}>
            {rate == null ? '—' : `${rate}%`}
          </p>
          <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** One ledger entry with its outcome, deadline and (in demos) the fast-forward control. */
export function PromiseRow({ entry, showCase = true, demo, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null);

  const fastForward = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/promises/${entry.id || entry._id}/fast-forward`);
      setLink(data.checkInUrl);
      toast('Deadline reached — the complainant has been asked to confirm');
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const overdue = entry.status === 'pending' && new Date(entry.dueDate) < Date.now() + 3 * DAY;

  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-paper-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <PromiseStatus status={entry.status} />
        <span className="font-semibold text-ink">{entry.action}</span>
        {money(entry.amount) && <span className="chip bg-paper-soft text-ink-soft">{money(entry.amount)}</span>}
        {entry.vague && <span className="chip bg-honey-50 text-honey-700" title="The institution gave no deadline; CaseLink set one">No deadline given</span>}
        {entry.kind === 'stall' && <span className="chip bg-rosewood-50 text-rosewood-700">No concrete action</span>}
        <span className={clsx('ml-auto text-xs font-medium', overdue ? 'text-honey-700' : 'text-ink-muted')}>{dueText(entry.dueDate, entry.status)}</span>
      </div>
      <blockquote className="mt-2 border-l-2 border-ember-200 pl-3 text-sm italic text-ink-soft">“{entry.text}”</blockquote>
      {entry.condition && <p className="mt-1.5 text-xs text-ink-muted">Condition attached: “{entry.condition}”</p>}
      {entry.checkIn?.answeredAt && (
        <p className="mt-1.5 text-xs text-ink-muted">
          Complainant answered <b className="text-ink">{{ yes: 'Yes', partly: 'Partly', no: 'No' }[entry.checkIn.answer]}</b> on {formatDate(entry.checkIn.answeredAt)}
          {entry.checkIn.comment && <> — “{entry.checkIn.comment}”</>}
        </p>
      )}
      {(showCase || demo) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showCase && (
            <>
              <BureauBadge code={entry.bureau} />
              <Link to={`/cases/${entry.case}`} className="font-mono text-xs text-ember-700 hover:underline">
                {entry.caseRef}
              </Link>
              {entry.institution?.name && (
                <Link to={`/institutions/${entry.institution.permanentId}`} className="truncate text-xs text-ink-muted hover:text-ember-700">
                  · {entry.institution.name}
                </Link>
              )}
            </>
          )}
          {demo && entry.status === 'pending' && (
            <Button size="sm" variant="secondary" icon={FastForward} loading={busy} onClick={fastForward} className="ml-auto">
              Fast-forward to deadline <span className="rounded bg-paper-deep px-1 text-[0.6rem] font-bold uppercase text-ink-muted">demo</span>
            </Button>
          )}
          {link && (
            <span className="ml-auto flex items-center gap-1.5">
              <a href={link} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-xs">
                Open complainant check-in <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button onClick={() => navigator.clipboard?.writeText(window.location.origin + link).then(() => toast('Check-in link copied'))} className="rounded-md p-1 text-ink-muted hover:bg-paper-soft" aria-label="Copy check-in link">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      )}
    </motion.li>
  );
}
