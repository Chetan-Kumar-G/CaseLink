import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Ban, BadgeCheck, CircleDot, FileCheck2, FileWarning, GitMerge, HandCoins, Handshake, MessageSquare, RefreshCcw, ShieldCheck, TrendingUp, Undo2 } from 'lucide-react';
import { HISTORY_LABEL, formatDateTime } from '../lib/format.js';
import { useMeta } from '../context/AuthContext.jsx';
import { BUREAU_STYLE, BureauBadge } from './badges.jsx';

const ICON = {
  registered: CircleDot,
  status_changed: RefreshCcw,
  note: MessageSquare,
  overlap_linked: GitMerge,
  overlap_dismissed: Ban,
  coordination_requested: Handshake,
  response_recorded: ShieldCheck,
  closure_accepted: FileCheck2,
  closure_more_requested: Undo2,
  escalated: TrendingUp,
  resolved_on_promise: HandCoins,
  promise_kept: BadgeCheck,
  promise_broken: FileWarning,
};

export default function Timeline({ events, showCase }) {
  const { statusLabel } = useMeta();
  return (
    <ol className="relative space-y-1">
      {events.map((e, i) => {
        const Icon = ICON[e.action] || CircleDot;
        const style = BUREAU_STYLE[e.bureau];
        return (
          <motion.li
            key={`${e.caseId || ''}-${e.at}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.6) }}
            className="relative flex gap-3 pb-4"
          >
            {i < events.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-paper-line" />}
            <span className={clsx('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white', style ? style.soft : 'bg-ember-50')}>
              <Icon className="h-4 w-4 text-ink-soft" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-ink">{HISTORY_LABEL[e.action] || e.action}</span>
                {e.to && e.action === 'status_changed' && <span className="text-xs text-ink-muted">→ {statusLabel(e.to)}</span>}
                {showCase && e.caseRef && (
                  <>
                    <BureauBadge code={e.bureau} />
                    <Link to={`/cases/${e.caseId}`} className="font-mono text-xs text-ember-700 hover:underline">
                      {e.caseRef}
                    </Link>
                  </>
                )}
              </div>
              {e.note && <p className="mt-0.5 break-words text-sm text-ink-soft">{e.note}</p>}
              <p className="mt-0.5 text-xs text-ink-faint">
                {e.byName} · {formatDateTime(e.at)}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
