import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * Single-series horizontal bar list. One hue per chart (identity comes from the
 * row label, not colour), value labels in ink, hover tooltip per bar.
 */
export function BarList({ rows, valueLabel = 'cases', barClass = 'bg-ember-500', secondary }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="space-y-3" role="list">
      {rows.map((r, i) => (
        <li
          key={r.key}
          className="relative"
          onMouseEnter={() => setHover(r.key)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(r.key)}
          onBlur={() => setHover(null)}
          tabIndex={0}
          aria-label={`${r.label}: ${r.value} ${valueLabel}${secondary ? `, ${r.secondary} ${secondary}` : ''}`}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink-soft">{r.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-ink">{r.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-paper-deep/70">
            <motion.div
              className={clsx('h-full rounded-full', r.barClass || barClass, hover && hover !== r.key && 'opacity-50')}
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {hover === r.key && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute -top-9 right-0 z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lift"
            >
              {r.label}: <b>{r.value}</b> {valueLabel}
              {secondary && ` · ${r.secondary} ${secondary}`}
            </motion.div>
          )}
        </li>
      ))}
    </ul>
  );
}
