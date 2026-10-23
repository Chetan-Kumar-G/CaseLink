import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, CheckCircle2, Clock } from 'lucide-react';
import { AnimatedNumber } from '../ui.jsx';

// Status colours (reserved meaning) — always paired with an icon and label.
const PARTS = [
  { key: 'onTime', label: 'On time', color: '#3F8F5B', icon: CheckCircle2, text: 'text-sage-700' },
  { key: 'dueSoon', label: 'Due within 3 days', color: '#C98A0B', icon: Clock, text: 'text-honey-700' },
  { key: 'overdue', label: 'Overdue', color: '#C2412D', icon: AlertOctagon, text: 'text-rosewood-700' },
];

/** Deadline health of open cases: the headline is the on-time share. */
export default function DeadlineRing({ deadline }) {
  const [hover, setHover] = useState(null);
  const total = PARTS.reduce((s, p) => s + deadline[p.key], 0);
  const pct = total ? Math.round((deadline.onTime / total) * 100) : 100;
  const R = 62;
  const C = 2 * Math.PI * R;
  const GAP = total > 1 ? 4 : 0; // 2px-each-side surface gap between arcs

  let offset = 0;
  const arcs = PARTS.map((p, i) => {
    const len = total ? (deadline[p.key] / total) * C : 0;
    const arc = { ...p, len: Math.max(0, len - GAP), offset, i };
    offset += len;
    return arc;
  }).filter((a) => deadline[a.key] > 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90" role="img" aria-label={`${pct}% of open cases are on time`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="#F7E9DA" strokeWidth="14" />
          {arcs.map((a) => (
            <motion.circle
              key={a.key}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.key ? 18 : 14}
              strokeLinecap="butt"
              strokeDasharray={`${a.len} ${C}`}
              initial={{ strokeDashoffset: -a.offset + a.len, opacity: 0 }}
              animate={{ strokeDashoffset: -a.offset, opacity: hover && hover !== a.key ? 0.35 : 1 }}
              transition={{ strokeDashoffset: { delay: 0.2 + a.i * 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.15 } }}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: 'stroke-width 150ms' }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-ink">
              <AnimatedNumber value={pct} />%
            </p>
            <p className="text-xs font-semibold text-ink-muted">on time</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {PARTS.map((p) => (
          <li
            key={p.key}
            tabIndex={0}
            onMouseEnter={() => setHover(p.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p.key)}
            onBlur={() => setHover(null)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 outline-none transition ${hover === p.key ? 'bg-paper-soft' : ''} focus-visible:ring-2 focus-visible:ring-ember-300`}
          >
            <p.icon className={`h-4 w-4 shrink-0 ${p.text}`} />
            <span className="flex-1 text-sm text-ink-soft">{p.label}</span>
            <span className="text-lg font-extrabold text-ink">{deadline[p.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
