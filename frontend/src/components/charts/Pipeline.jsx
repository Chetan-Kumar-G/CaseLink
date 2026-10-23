import { useState } from 'react';
import { motion } from 'framer-motion';
import { PIPELINE_HEX } from './common.jsx';

/**
 * Where every case sits in the workflow. Stages are ordered, so they take an
 * ordinal one-hue ramp (light = early, dark = done). The legend below lists
 * every stage with its count, so no value depends on hovering.
 */
export default function Pipeline({ pipeline }) {
  const [hover, setHover] = useState(null);
  const total = pipeline.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <div>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg" role="img" aria-label={pipeline.map((p) => `${p.label} ${p.count}`).join(', ')}>
        {pipeline.map((p, i) =>
          p.count ? (
            <motion.button
              key={p.status}
              type="button"
              className="relative h-full first:rounded-l-lg last:rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              style={{ background: PIPELINE_HEX[p.status] }}
              initial={{ flexGrow: 0.0001, opacity: 0 }}
              animate={{ flexGrow: p.count, opacity: hover && hover !== p.status ? 0.35 : 1 }}
              transition={{ flexGrow: { delay: 0.15 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.15 } }}
              onMouseEnter={() => setHover(p.status)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.status)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${p.count} cases (${Math.round((p.count / total) * 100)}%)`}
            >
              {p.count / total > 0.09 && <span className="text-xs font-bold text-white">{p.count}</span>}
            </motion.button>
          ) : null,
        )}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 xl:grid-cols-1 2xl:grid-cols-2">
        {pipeline.map((p) => (
          <li
            key={p.status}
            onMouseEnter={() => setHover(p.status)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 text-sm transition-opacity ${hover && hover !== p.status ? 'opacity-40' : ''}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PIPELINE_HEX[p.status] }} />
            <span className="flex-1 truncate text-ink-soft">{p.label}</span>
            <span className="font-bold tabular-nums text-ink">{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
